import {buildModule} from "@nomicfoundation/hardhat-ignition/modules";

const evmClient = buildModule("EvmClient", (m) => {
    const owner = m.getAccount(0);
    const contract = m.contract("EvmClient", [owner]);

    return { contract }
});

export default evmClient;