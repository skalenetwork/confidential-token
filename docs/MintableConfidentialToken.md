# Solidity API

## MintableConfidentialToken

ConfidentialToken with minting functionality

### constructor

Sets up the contract for proxy or direct deployment.

```solidity
constructor(bool proxyMode, string name, string symbol, string version_, address initialAuthority) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxyMode | bool | If true, disables initializers for proxy deployment.                  If false, initializes the contract directly. |
| name | string | Name of the token. Ignored when proxyMode is true. |
| symbol | string | Symbol of the token. Ignored when proxyMode is true. |
| version_ | string | Version of the token. Ignored when proxyMode is true. |
| initialAuthority | address | Initial authority address. Ignored when proxyMode is true. |

### mint

Mints new tokens to the specified address

```solidity
function mint(address to, uint256 amount) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address to mint tokens to |
| amount | uint256 | The amount of tokens to mint |

### burn

Burns tokens from the caller's account

```solidity
function burn(uint256 amount) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of tokens to burn |

### initialize

Initializes the contract for proxy deployment.

```solidity
function initialize(string name, string symbol, string version_, address initialAuthority) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | Name of the token. |
| symbol | string | Symbol of the token. |
| version_ | string | Version of the token. |
| initialAuthority | address | Initial authority address. |

### __MintableConfidentialToken_init

```solidity
function __MintableConfidentialToken_init(string name, string symbol, string version_, address initialAuthority) internal
```

