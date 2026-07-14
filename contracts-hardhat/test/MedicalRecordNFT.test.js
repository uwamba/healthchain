const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalRecordNFT", function () {
  let nft;
  let owner, minter, patient, stranger;

  beforeEach(async function () {
    [owner, minter, patient, stranger] = await ethers.getSigners();

    const MedicalRecordNFT = await ethers.getContractFactory("MedicalRecordNFT");
    nft = await MedicalRecordNFT.deploy();
    await nft.deployed();
  });

  it("lets the owner set the minter exactly once", async function () {
    await nft.connect(owner).setMinter(minter.address);
    expect(await nft.minter()).to.equal(minter.address);

    await expect(nft.connect(owner).setMinter(stranger.address)).to.be.revertedWith(
      "Minter already set"
    );
  });

  it("rejects setMinter from a non-owner", async function () {
    await expect(nft.connect(stranger).setMinter(minter.address)).to.be.revertedWithCustomError(
      nft,
      "OwnableUnauthorizedAccount"
    );
  });

  it("mints a record NFT to a patient and emits RecordMinted", async function () {
    await nft.connect(owner).setMinter(minter.address);

    await expect(nft.connect(minter).mint(patient.address, "ipfs://someCid"))
      .to.emit(nft, "RecordMinted")
      .withArgs(0, patient.address, "ipfs://someCid");

    expect(await nft.ownerOf(0)).to.equal(patient.address);
    expect(await nft.tokenURI(0)).to.equal("ipfs://someCid");
  });

  it("rejects mint from anyone other than the minter", async function () {
    await nft.connect(owner).setMinter(minter.address);

    await expect(nft.connect(stranger).mint(patient.address, "ipfs://someCid")).to.be.revertedWith(
      "Only minter"
    );
  });
});
