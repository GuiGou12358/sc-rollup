export const ABI = [
  {
    inputs: [
      {
        internalType: "bytes",
        name: "key",
        type: "bytes",
      },
    ],
    name: "getStorage",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes[]",
        name: "condKeys",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "condValues",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "updateKeys",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "updateValues",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "actions",
        type: "bytes[]",
      },
    ],
    name: "rollupU256CondEq",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },{
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      }
    ],
    name: "metaTxPrepare",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        internalType: "struct MetaTxReceiver.ForwardRequest",
        name: "",
        type: "tuple"
      },
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  }, {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        internalType: "struct MetaTxReceiver.ForwardRequest",
        name: "req",
        type: "tuple"
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes"
      }
    ],
    name: "metaTxRollupU256CondEq",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
]