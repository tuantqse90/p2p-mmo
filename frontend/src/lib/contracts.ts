export const P2PEscrowABI = [
  {
    type: "function",
    name: "createOrder",
    inputs: [
      { name: "seller", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "productHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sellerConfirmDelivery",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyerConfirmReceived",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelOrder",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "openDispute",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "evidenceHash", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitEvidence",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "ipfsHash", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveDispute",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "favorBuyer", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getOrder",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "arbitrator", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "platformFee", type: "uint256" },
          { name: "arbitrationFee", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "productHash", type: "bytes32" },
          { name: "createdAt", type: "uint256" },
          { name: "sellerConfirmedAt", type: "uint256" },
          { name: "disputeDeadline", type: "uint256" },
          { name: "evidenceBuyer", type: "string" },
          { name: "evidenceSeller", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportedTokens",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "productHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderCompleted",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "amountToSeller", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;
