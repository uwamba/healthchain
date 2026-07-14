// Server-side proxy to Pinata. Keeps PINATA_JWT off the browser bundle —
// the client uploads the file here, and this route forwards it to Pinata
// using the secret token, then returns just the resulting CID.
export async function POST(request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return Response.json(
      { error: "PINATA_JWT is not set in .env.local on the server." },
      { status: 500 }
    );
  }

  const incomingForm = await request.formData();
  const file = incomingForm.get("file");

  if (!file) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append("file", file, file.name);

  const pinataResponse = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
    }
  );

  if (!pinataResponse.ok) {
    const text = await pinataResponse.text();
    return Response.json({ error: "Pinata upload failed: " + text }, { status: 502 });
  }

  const data = await pinataResponse.json();
  return Response.json({ cid: data.IpfsHash });
}
