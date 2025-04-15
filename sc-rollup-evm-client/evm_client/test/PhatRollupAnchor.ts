import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {EvmClient} from "../typechain-types";
import {Signer} from "ethers";

function abiEncode(type: string, value: any) {
  return ethers.AbiCoder.defaultAbiCoder().encode([type], [value]);
}
function encodeIndex(v: number) {
  return abiEncode('uint', v);
}
function encodeVersion(v: number) {
  return abiEncode('uint', v);
}


describe("RollupAnchor", function () {

  async function registerAttestor(contract: EvmClient, owner : Signer, attestor : Signer){

    const ATTESTOR_ROLE = await contract.ATTESTOR_ROLE();

    // preconditions
    expect (await contract.hasRole(ATTESTOR_ROLE, attestor.getAddress())).to.equal(false);

    expect(await contract.connect(owner).grantRole(ATTESTOR_ROLE, attestor)).not.to.be.reverted;

    // post condition
    expect (await contract.hasRole(ATTESTOR_ROLE, attestor.getAddress())).to.equal(true);
  }

  async function deployContractFixture(){
    const [owner, attestor, addr1, addr2] = await ethers.getSigners();

    // deploy the contract
    const contract = await ethers.deployContract("EvmClient", [owner]);
    // register attestor
    await registerAttestor(contract, owner, attestor);

    return {contract, owner, attestor, addr1, addr2};
  }

  describe("Rollup", function () {
    it("Should not forward from random attestor", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);
      await expect(
        contract.connect(owner).rollupU256CondEq(
          // cond
          [], [],
          // updates
          [], [],
          // actions
          [],
        )
      ).to.be.revertedWithCustomError(contract, 'BadAttestor');
    });

    it("Should not allow invalid input arrays", async function () {
      const { contract, attestor } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          ['0x01'], [],
          // updates
          [], [],
          // actions
          [],
        )
      ).to.be.revertedWithCustomError(contract, 'BadCondLen');

      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          [], [],
          // updates
          ['0x'], [],
          // actions
          [],
        )
      ).to.be.revertedWithCustomError(contract, 'BadUpdateLen');
    });

    it("Should not allow incorrect action", async function () {
      const { contract, attestor } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          [], [],
          // updates
          [], [],
          // actions
          ['0xff'],
        )
      ).to.be.revertedWithCustomError(contract, 'UnsupportedAction');
    });

    it("Should update values", async function () {
      const { contract, attestor } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          [], [],
          // updates
          ['0xbeef'],
          ['0xdead'],
          // actions
          [],
        )
      ).not.to.be.reverted;

      // check the storage
      expect(await contract.getStorage('0xbeef')).to.be.equals('0xdead');
    });

  });

    it("Should forward actions", async function () {
      const { contract, attestor } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          [], [],
          // updates
          [], [],
          // actions
          [
            // Callback: req 00 responded with 0xDEADBEEF
            ethers.concat(['0x00', '0xDEADBEEF']),
          ],
        )
      ).not.to.be.reverted;
    });


    it("Push and poll messages", async function () {
      const { contract, owner, attestor } = await loadFixture(deployContractFixture);


      const QUEUE_HEAD = '0x712f5f68656164';
      const QUEUE_TAIL = '0x712f5f7461696c';
      expect(ethers.hexlify(ethers.toUtf8Bytes('q/_head'))).to.be.equals(QUEUE_HEAD);
      expect(ethers.hexlify(ethers.toUtf8Bytes('q/_tail'))).to.be.equals(QUEUE_TAIL);

      expect(await contract.getStorage(QUEUE_HEAD)).to.be.equals('0x');
      expect(await contract.getStorage(QUEUE_TAIL)).to.be.equals('0x');

      await expect(contract.connect(owner).pushMessage('0xbeef')).to.not.reverted;
      await expect(contract.connect(owner).pushMessage('0xdead')).to.not.reverted;


      // check the storage
      expect(await contract.getStorage(QUEUE_HEAD)).to.be.equals('0x');
      expect(await contract.getStorage(QUEUE_TAIL)).to.be.equals(encodeIndex(2));
      expect(await contract.getStorage('0x712f0000000000000000000000000000000000000000000000000000000000000000')).to.be.equals('0xbeef');
      expect(await contract.getStorage('0x712f0000000000000000000000000000000000000000000000000000000000000001')).to.be.equals('0xdead');
      expect(await contract.getStorage('0x712f0000000000000000000000000000000000000000000000000000000000000002')).to.be.equals('0x');

      // set queue head => remove messages
      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          [], [],
          // updates
          [], [],
          // actions
          [
            // Custom: queue processed to 2
            ethers.concat(['0x01', encodeIndex(2)]),
          ],
        )
      ).not.to.be.reverted;

      // check the storage
      // check the storage
      expect(await contract.getStorage(QUEUE_HEAD)).to.be.equals(encodeIndex(2));
      expect(await contract.getStorage(QUEUE_TAIL)).to.be.equals(encodeIndex(2));
      expect(await contract.getStorage('0x712f0000000000000000000000000000000000000000000000000000000000000001')).to.be.equals('0x');
      expect(await contract.getStorage('0x712f0000000000000000000000000000000000000000000000000000000000000002')).to.be.equals('0x');

    });



  describe("OptimisticLock", function () {
    it("Should reject conflicting transaction", async function () {
      const { contract, attestor } = await loadFixture(deployContractFixture);
      // Rollup from v0 to v1
      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          ['0x01'],
          ['0x'],
          // updates
          ['0x01'],
          [encodeVersion(1)],
          // actions
          [],
        )
      ).not.to.be.reverted;

      expect(await contract.getStorage('0x01')).to.be.equals(encodeVersion(1));

      // Rollup to v1 again
      await expect(
        contract.connect(attestor).rollupU256CondEq(
          // cond
          ['0x01'],
          ['0x'],
          // updates
          ['0x01'],
          [encodeVersion(1)],
          // actions
          [],
        )
      ).to.be
        .revertedWithCustomError(contract, 'CondNotMet')
        // We want to ensure 0x01 to match 0, but the value is 1.
        .withArgs('0x01', encodeVersion(1), '0x');
    });
  });

  describe("Meta Transaction", function () {
    it("Process the request", async function () {
      const { contract, attestor, addr1 } = await loadFixture(deployContractFixture);
      // build the meta-transaction
      const [metaTxData1, metaTxSig1] = await metaTx([
        [], [], [], [],
        // Set the config (4 numbers between 1 and 50)
        ['0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000021'],
      ], attestor, 0, await contract.getAddress());
      // Send meta-tx via addr1 on behalf of attestor
      const rollupTx = await contract.connect(addr1).metaTxRollupU256CondEq(metaTxData1, metaTxSig1);
      await expect(rollupTx).not.to.be.reverted;
      // check

    })
  });
});

interface MetaTxData {
  from: string;
  nonce: number;
  data: string;
};
type RollupParams = [string[], string[], string[], string[], string[]];

async function signMetaTx(signer: SignerWithAddress, contractAddress: string, value: MetaTxData) {
  // All properties on a domain are optional
  const domain = {
    name: 'PhatRollupMetaTxReceiver',
    version: '0.0.1',
    chainId: 31337,  // hardhat chain id
    verifyingContract: contractAddress
  };
  const types = {
    ForwardRequest: [
      { name: 'from', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'data', type: 'bytes' }
    ]
  };
  return await signer.signTypedData(domain, types, value);
}

async function metaTx(rollupParams: RollupParams, signer: SignerWithAddress, nonce: number, contractAddress: string): Promise<[MetaTxData, string]> {
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes[]', 'bytes[]', 'bytes[]', 'bytes[]', 'bytes[]'],
    rollupParams,
  );
  const metaTxData = {
    from: signer.address,
    nonce,
    data,
  };
  const metaTxSig = await signMetaTx(signer, contractAddress, metaTxData);
  return [metaTxData, metaTxSig]
}
