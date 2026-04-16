// cspell:words ECIES

import { ethers } from "hardhat";
import chalk from "chalk";
import { MintableConfidentialToken, AccessManager } from "../typechain-types";
import { HDNodeWallet, LogDescription, parseEther } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { privateKeyToPublicKey, decodeTransferData, decrypt } from "../test/tools/utils";

const TOKEN_NAME = "Test Confidential Token";
const TOKEN_SYMBOL = "tCTK";
const VERSION = "test-v1";
const MINT_AMOUNT = parseEther("1000");
const ETH_FUND_AMOUNT = parseEther("1");
const ETH_DEPOSIT = parseEther("0.5");
const CALLBACK_POLL_INTERVAL_MS = 1000;

let token: MintableConfidentialToken;
let accessManager: AccessManager;
let deployer: SignerWithAddress;
let walletA: HDNodeWallet;
let walletB: HDNodeWallet;
let walletC: HDNodeWallet;

const generateAndFundWallets = async () => {
    const provider = ethers.provider;
    walletA = HDNodeWallet.createRandom().connect(provider);
    walletB = HDNodeWallet.createRandom().connect(provider);
    walletC = HDNodeWallet.createRandom().connect(provider);

    console.log(chalk.cyan("\n--- Generated Wallets ---"));
    console.log(chalk.gray(`Wallet A: ${walletA.address}  (pk: ${walletA.privateKey})`));
    console.log(chalk.gray(`Wallet B: ${walletB.address}  (pk: ${walletB.privateKey})`));
    console.log(chalk.gray(`Wallet C: ${walletC.address}  (pk: ${walletC.privateKey})`));
    console.log();

    console.log(chalk.yellow("Funding wallets with native gas token..."));
    for (const wallet of [walletA, walletB, walletC]) {
        const tx = await deployer.sendTransaction({ to: wallet.address, value: ETH_FUND_AMOUNT });
        await tx.wait();
        console.log(`  Funded ${wallet.address} with ${ethers.formatEther(ETH_FUND_AMOUNT)} ETH`);
    }
};

const deploy = async () => {
    console.log(chalk.yellow("Deploying AccessManager..."));
    const accessManagerFactory = await ethers.getContractFactory("AccessManager");
    accessManager = await accessManagerFactory.deploy(deployer);
    await accessManager.deploymentTransaction()!.wait();
    console.log(`  AccessManager deployed at: ${chalk.green(await ethers.resolveAddress(accessManager))}`);

    console.log(chalk.yellow("Deploying MintableConfidentialToken..."));
    const tokenFactory = await ethers.getContractFactory("MintableConfidentialToken");
    token = await tokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        VERSION,
        await ethers.resolveAddress(accessManager)
    );
    await token.deploymentTransaction()!.wait();
    console.log(`  Token deployed at: ${chalk.green(await ethers.resolveAddress(token))}`);
    console.log(`  Name: ${await token.name()}, Symbol: ${await token.symbol()}, Version: ${await token.version()}`);
};

const depositEthForCallbacks = async () => {
    console.log(chalk.yellow("Depositing ETH for callback fees..."));
    for (const wallet of [deployer, walletA, walletB, walletC]) {
        const address = await ethers.resolveAddress(wallet);
        const tx = await token.connect(wallet).deposit(address, { value: ETH_DEPOSIT });
        await tx.wait();
        const balance = await token.ethBalanceOf(address);
        console.log(`  ${address} deposited ${ethers.formatEther(ETH_DEPOSIT)} — callback balance: ${ethers.formatEther(balance)}`);
    }
};

const testMinting = async () => {
    console.log(chalk.yellow("\nMinting tokens to walletA and walletB..."));

    const recipients = [
        { label: "walletA", signer: walletA },
        { label: "walletB", signer: walletB },
    ];

    for (const { label, signer } of recipients) {
        const address = await ethers.resolveAddress(signer);
        const tx = await token.connect(deployer).mint(address, MINT_AMOUNT);
        await tx.wait();
        console.log(`  Minted ${ethers.formatEther(MINT_AMOUNT)} tokens to ${label} (${address})`);
    }

    const supply = await token.totalSupply();
    console.log(`  Total supply: ${ethers.formatEther(supply)}`);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Reusable helpers ---

/**
 * Registers a viewer's public key and sets them as the holder's viewer.
 * Waits for the BITE callback to complete (encrypted balance becomes available).
 */
const registerViewer = async (
    holder: SignerWithAddress | HDNodeWallet,
    viewerPrivateKey: string
) => {
    const holderAddress = await ethers.resolveAddress(holder);
    const viewerAddress = ethers.computeAddress(viewerPrivateKey);
    const pubKey = privateKeyToPublicKey(viewerPrivateKey);

    console.log(`  Registering viewer ${viewerAddress} for holder ${holderAddress}`);
    const tx = await token.connect(holder).setViewerPublicKey(pubKey);
    const receipt = await tx.wait();
    const submitBlock = receipt!.blockNumber;
    console.log(`    Tx confirmed in block ${submitBlock}, waiting for callback...`);

    await sleep(2000);
    while ((await ethers.provider.getBlockNumber()) <= submitBlock) {
        process.stdout.write(".");
        await sleep(CALLBACK_POLL_INTERVAL_MS);
    }
    console.log("    Callback block reached — viewer registered");
};

/**
 * Reads the on-chain ECIES-encrypted balance and decrypts it with the given private key.
 * Returns the decrypted balance as bigint.
 */
const readAndDecryptBalance = async (
    holderAddress: string,
    viewerPrivateKey: string
): Promise<bigint> => {
    const encrypted = await token.encryptedBalanceOf(holderAddress);
    const decrypted = decrypt(viewerPrivateKey, encrypted);
    return BigInt(`0x${decrypted.toString("hex")}`);
};

/**
 * Waits for the callback block after a tx that submitted a CTX, then decrypts the balance once.
 * Returns the actual decrypted value — caller is responsible for asserting correctness.
 */
const waitForCallbackAndDecrypt = async (
    submitBlock: number,
    holderAddress: string,
    viewerPrivateKey: string
): Promise<bigint> => {
    if((await ethers.provider.getBlockNumber()) > submitBlock){
        return readAndDecryptBalance(holderAddress, viewerPrivateKey);
    }
    await sleep(CALLBACK_POLL_INTERVAL_MS);
    while ((await ethers.provider.getBlockNumber()) <= submitBlock) {
        process.stdout.write(".");
        await sleep(CALLBACK_POLL_INTERVAL_MS);
    }
    return readAndDecryptBalance(holderAddress, viewerPrivateKey);
};

/**
 * Attempts to decrypt a holder's balance with a wrong viewer key.
 * Succeeds (returns) only if decryption throws — i.e. the key is not the correct viewer.
 */
const expectDecryptionFailure = async (
    holderAddress: string,
    wrongViewerPrivateKey: string
) => {
    try {
        const balance = await readAndDecryptBalance(holderAddress, wrongViewerPrivateKey);
        throw new Error(
            `Decryption should have failed but got ${ethers.formatEther(balance)}`
        );
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.startsWith("Decryption should have failed")) throw error;
        if (msg.startsWith("Timeout:")) throw error;
        console.log(chalk.green(`    PASS — decryption correctly failed (${msg})`));
    }
};

/**
 * Fetches all token-contract events from a specific block by iterating transaction receipts.
 * Bypasses queryFilter/getLogs which breaks on SKALE due to non-standard `polarity` field.
 */
const getTokenEventsFromBlock = async (blockNumber: number) => {
    const block = await ethers.provider.getBlock(blockNumber);
    if (!block) throw new Error(`Block ${blockNumber} not found`);

    const allEvents: { txHash: string; event: LogDescription }[] = [];
    const tokenAddress = (await ethers.resolveAddress(token)).toLowerCase();

    for (const txHash of block.transactions) {
        const receipt = await ethers.provider.getTransactionReceipt(txHash);
        if (!receipt) continue;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== tokenAddress) continue;
            try {
                const parsed = token.interface.parseLog(log);
                if (parsed) allEvents.push({ txHash, event: parsed });
            } catch { /* not a known token event */ }
        }
    }
    return { block, allEvents };
};

/**
 * Executes a token transfer, waits for the BITE callback in the next block,
 * and returns the callback tx hash along with all parsed events from the callback.
 */
const transferAndGetEventData = async (
    from: SignerWithAddress | HDNodeWallet,
    to: SignerWithAddress | HDNodeWallet,
    amount: bigint
) => {
    const fromAddress = await ethers.resolveAddress(from);
    const toAddress = await ethers.resolveAddress(to);

    // 1. Execute the transfer
    console.log(`  Transferring ${ethers.formatEther(amount)} from ${fromAddress} to ${toAddress}...`);
    const tx = await token.connect(from).transfer(toAddress, amount);
    const receipt = await tx.wait();
    const submitBlock = receipt!.blockNumber;
    console.log(`    Submitted in block ${submitBlock} (tx: ${tx.hash})`);

    // 2. Wait for the next block — the callback will be processed there
    console.log("    Waiting for callback block...");
    while ((await ethers.provider.getBlockNumber()) <= submitBlock) {
        process.stdout.write(".");
        await sleep(CALLBACK_POLL_INTERVAL_MS);
    }

    // 3. Search for the EncryptedTransfer event in the callback block
    const { allEvents } = await getTokenEventsFromBlock(submitBlock + 1);

    const match = allEvents.find(
        e => e.event.name === "EncryptedTransfer"
            && e.event.args[1].toLowerCase() === fromAddress.toLowerCase()
            && e.event.args[2].toLowerCase() === toAddress.toLowerCase()
    );
    if (!match) throw new Error(`EncryptedTransfer callback not found in block ${submitBlock + 1}`);

    const callbackTxHash = match.txHash;
    const events = allEvents.filter(e => e.txHash === callbackTxHash).map(e => e.event);
    console.log(`\n    Callback tx (CTX hash): ${callbackTxHash}`);
    console.log(`    Callback emitted ${events.length} event(s): [${events.map(e => e.name).join(", ")}]`);

    return { callbackTxHash, events };
};

/**
 * Requests historic decryption of a transfer for a given wallet.
 * The wallet must be a registered user with deposited ETH for the callback fee.
 * Returns the submit block number and tx hash.
 */
const requestHistoricDecryption = async (
    encryptedTransferData: string,
    requester: SignerWithAddress | HDNodeWallet
) => {
    const requesterAddress = await ethers.resolveAddress(requester);
    console.log(`  Requesting historic decryption as ${requesterAddress}...`);
    const tx = await token.connect(requester).requestDecryptHistoricTransfer(encryptedTransferData);
    const receipt = await tx.wait();
    const submitBlock = receipt!.blockNumber;
    console.log(`    Submitted in block ${submitBlock} (tx: ${tx.hash})`);
    return { submitBlock, txHash: tx.hash };
};

/**
 * Requests historic decryption and expects a successful callback that emits ReEncryptedTransfer.
 * Returns the parsed ReEncryptedTransfer event and the callback tx hash.
 */
const requestHistoricDecryptionExpectSuccess = async (
    encryptedTransferData: string,
    requester: SignerWithAddress | HDNodeWallet,
    requesterPrivateKey: string
) => {
    const requesterAddress = await ethers.resolveAddress(requester);
    const { submitBlock } = await requestHistoricDecryption(encryptedTransferData, requester);

    console.log("    Waiting for callback block...");
    await sleep(2000);
    while ((await ethers.provider.getBlockNumber()) <= submitBlock) {
        process.stdout.write(".");
        await sleep(CALLBACK_POLL_INTERVAL_MS);
    }

    const { allEvents } = await getTokenEventsFromBlock(submitBlock + 1);

    const match = allEvents.find(
        e => e.event.name === "ReEncryptedTransfer"
            && e.event.args[0].toLowerCase() === requesterAddress.toLowerCase()
    );
    if (!match) throw new Error(`Expected ReEncryptedTransfer in block ${submitBlock + 1} but found none`);

    const callbackTxHash = match.txHash;
    const events = allEvents.filter(e => e.txHash === callbackTxHash).map(e => e.event);
    console.log(`    Callback tx: ${callbackTxHash}`);
    console.log(`    Callback emitted ${events.length} event(s): [${events.map(e => e.name).join(", ")}]`);

    const reEncrypted = match.event;

    // Decrypt the ECIES-encrypted transfer value off-chain using the requester's private key
    const decryptedBuf = decrypt(requesterPrivateKey, reEncrypted.args[3]);
    const decodeTransferDataResult = decodeTransferData(`0x${decryptedBuf.toString("hex")}`);
    const decryptedValue = decodeTransferDataResult.value;
    console.log(`    Decrypted transfer value: ${ethers.formatEther(decryptedValue)}`);

    return { callbackTxHash, reEncryptedEvent: reEncrypted, events, decryptedValue };
};

/**
 * Requests historic decryption and expects the callback to fail (no ReEncryptedTransfer emitted).
 * Verifies that the callback block has at least one transaction but no matching event.
 * TODO: improve by checking for a specific revert reason in the callback tx.
 */
const requestHistoricDecryptionExpectFailure = async (
    encryptedTransferData: string,
    requester: SignerWithAddress | HDNodeWallet
) => {
    const requesterAddress = await ethers.resolveAddress(requester);
    const { submitBlock } = await requestHistoricDecryption(encryptedTransferData, requester);

    console.log("    Waiting for callback block...");
    await sleep(2000);
    while ((await ethers.provider.getBlockNumber()) <= submitBlock) {
        process.stdout.write(".");
        await sleep(CALLBACK_POLL_INTERVAL_MS);
    }

    const { block, allEvents } = await getTokenEventsFromBlock(submitBlock + 1);
    if (block.transactions.length === 0) {
        // TODO: distinguish between "no callback at all" and "callback reverted"
        throw new Error(`No transactions found in block ${submitBlock + 1}`);
    }

    const match = allEvents.find(
        e => e.event.name === "ReEncryptedTransfer"
            && e.event.args[0].toLowerCase() === requesterAddress.toLowerCase()
    );
    if (match) {
        throw new Error("ReEncryptedTransfer was emitted — expected the callback to fail");
    }

    console.log(chalk.green(`    PASS — no ReEncryptedTransfer in block ${submitBlock + 1} (${block.transactions.length} tx(s) present)`));
};

// --- Test functions ---

const testDecryptDeployerBalance = async () => {
    console.log(chalk.yellow("\n--- Test: deployer self-view & balance decryption ---"));
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    if (!deployerPrivateKey) throw new Error("PRIVATE_KEY env var required");

    await registerViewer(deployer, deployerPrivateKey);

    const balancePre = await readAndDecryptBalance(deployer.address, deployerPrivateKey);
    console.log(`  Decrypted balance (pre-mint): ${ethers.formatEther(balancePre)}`);

    console.log(chalk.yellow("  Minting tokens to deployer..."));
    const mintReceipt = await (await token.connect(deployer).mint(deployer.address, MINT_AMOUNT)).wait();
    console.log(`    Mint tx confirmed in block ${mintReceipt!.blockNumber}, waiting for callback...`);

    const balancePost = await waitForCallbackAndDecrypt(mintReceipt!.blockNumber, deployer.address, deployerPrivateKey);
    console.log(`  Decrypted balance (post-mint): ${ethers.formatEther(balancePost)}`);
    if (balancePost !== MINT_AMOUNT) {
        throw new Error(`Expected ${ethers.formatEther(MINT_AMOUNT)}, got ${ethers.formatEther(balancePost)}`);
    }
    console.log(chalk.green(`  PASS — balance matches expected ${ethers.formatEther(MINT_AMOUNT)}`));

    console.log(chalk.yellow("  Verifying wrong viewer key cannot decrypt..."));
    await expectDecryptionFailure(deployer.address, walletA.privateKey);
};

const testTransferAndEvents = async () => {
    console.log(chalk.yellow("\n--- Test: transfer & callback event data ---"));
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    if (!deployerPrivateKey) throw new Error("PRIVATE_KEY env var required");

    const transferAmount = parseEther("100");

    // Transfer deployer → walletA and capture callback events
    const { callbackTxHash, events } = await transferAndGetEventData(deployer, walletA, transferAmount);

    // Verify EncryptedTransfer event is present with correct from/to
    const encTransfer = events.find(e => e.name === "EncryptedTransfer");
    if (!encTransfer) throw new Error("EncryptedTransfer event missing from callback");
    console.log(`  EncryptedTransfer — transferId: ${encTransfer.args[0]}, from: ${encTransfer.args[1]}, to: ${encTransfer.args[2]}`);
    console.log(`  EncryptedTransfer — encryptedData: ${encTransfer.args[3].slice(0, 40)}...`);

    // Verify basic Transfer event
    const basicTransfer = events.find(e => e.name === "Transfer");
    if (!basicTransfer) throw new Error("Transfer event missing from callback");

    console.log(chalk.green(`  PASS — callback tx ${callbackTxHash.slice(0, 18)}... emitted expected events`));

    // Verify deployer balance decreased (callback already landed — transferAndGetEventData waited for it)
    const expectedBalance = MINT_AMOUNT - transferAmount;
    const deployerBalance = await readAndDecryptBalance(deployer.address, deployerPrivateKey);
    console.log(`  Deployer balance after transfer: ${ethers.formatEther(deployerBalance)}`);
    if (deployerBalance !== expectedBalance) {
        throw new Error(`Expected ${ethers.formatEther(expectedBalance)}, got ${ethers.formatEther(deployerBalance)}`);
    }
    console.log(chalk.green(`  PASS — deployer balance is ${ethers.formatEther(expectedBalance)}`));
    return { txId: encTransfer.args[0], transferData: encTransfer.args[3] };
};

const testHistoricDecryption = async (txId: string, transferData: string) => {
    console.log(chalk.yellow("\n--- Test: historic decryption ---"));
    const deployerPrivateKey = process.env.PRIVATE_KEY;
    if (!deployerPrivateKey) throw new Error("PRIVATE_KEY env var required");
    // We register walletA as it's own viewer to be allowed also historic decryption
    let tx = await token.connect(walletA).setViewerPublicKey(privateKeyToPublicKey(walletA.privateKey));
    await tx.wait();

    // Register walletB public key
    tx = await token.connect(walletB).registerPublicKey(privateKeyToPublicKey(walletB.privateKey));
    await tx.wait();

    // WalletB was not yet allowed
    await requestHistoricDecryptionExpectFailure(transferData, walletB);

    // WalletA is allowed by default because it is the recipient
    const { decryptedValue: decryptedValueA } = await requestHistoricDecryptionExpectSuccess(transferData, walletA, walletA.privateKey);

    // Deployer is allowed by default because it is the sender
    const { decryptedValue: decryptedValueDeployer } = await requestHistoricDecryptionExpectSuccess(transferData, deployer, deployerPrivateKey);

    // Allow walletB to do historic decryption
    tx = await token.connect(deployer).authorizeHistoricViewTransferId(walletB.address, txId);
    await tx.wait();

    // WalletB is now allowed to decrypt
    const { decryptedValue: decryptedValueBV1 } = await requestHistoricDecryptionExpectSuccess(transferData, walletB, walletB.privateKey);

    tx = await token.connect(deployer).removeHistoricViewTransferId(walletB.address, txId);
    await tx.wait();

    // WalletB is no longer allowed to decrypt
    await requestHistoricDecryptionExpectFailure(transferData, walletB);

    // Allow walletB to decrypt by time range through walletA
    tx = await token.connect(walletA).authorizeHistoricViewTimeRange(walletB.address, 0, 2n ** 64n);
    await tx.wait();

    // WalletB is now allowed to decrypt by time range
    const { decryptedValue: decryptedValueBV2 } = await requestHistoricDecryptionExpectSuccess(transferData, walletB, walletB.privateKey);

    // Remove all historic view permissions for walletB
    tx = await token.connect(walletA).removeHistoricViewAuth(walletB.address);
    await tx.wait();

    // WalletB is no longer allowed to decrypt by time range
    await requestHistoricDecryptionExpectFailure(transferData, walletB);

    const allDecrypted = [decryptedValueA, decryptedValueDeployer, decryptedValueBV1, decryptedValueBV2];
    const uniqueValue = allDecrypted.reduce((prev, cur) => {
        if (prev !== cur) throw new Error(`Decrypted values mismatch: ${prev} !== ${cur}`);
        return cur;
    });
    console.log(chalk.green(`  PASS — all ${allDecrypted.length} historic decryptions match: ${ethers.formatEther(uniqueValue)}`));
};

const cleanup = async () => {
    console.log(chalk.yellow("\nCleaning up: withdrawing ETH from token and returning funds to deployer..."));
    const wallets = [walletA, walletB, walletC, deployer];
    const deployerAddress = await ethers.resolveAddress(deployer);

    for (const wallet of wallets) {
        try {
            const address = await ethers.resolveAddress(wallet);
            const tokenEthBalance = await token.ethBalanceOf(address);
            if (tokenEthBalance > 0n) {
                const tx = await token.connect(wallet).withdraw(tokenEthBalance, address);
                await tx.wait();
                console.log(`  ${address} withdrew ${ethers.formatEther(tokenEthBalance)} from token contract`);
            }
        } catch (e) {
            console.log(chalk.red(`  Failed to withdraw token ETH for ${await ethers.resolveAddress(wallet)}: ${e}`));
        }
    }

    for (const wallet of [walletA, walletB, walletC]) {
        try {
            const balance = await ethers.provider.getBalance(wallet.address);
            console.log(`  ${wallet.address} native balance: ${ethers.formatEther(balance)}`);
            if (balance === 0n) continue;

            const txRequest = { to: deployerAddress, value: 0n };
            const estimatedGas = await wallet.estimateGas(txRequest);
            const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? parseEther("0.000000001");
            console.log(`    Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei, estimated gas: ${estimatedGas}`);
            const gasCost = (estimatedGas + 10000n) * gasPrice; // Add 10k buffer
            const sendable = balance - gasCost;
            if (sendable > 0n) {
                const tx = await wallet.sendTransaction({ ...txRequest, value: sendable, gasLimit: estimatedGas, gasPrice: gasPrice });
                await tx.wait();
                console.log(`    Returned ${ethers.formatEther(sendable)} ETH to deployer`);
            } else {
                console.log(chalk.gray(`    Balance too low to cover gas — skipping`));
            }
        } catch (e) {
            console.log(chalk.red(`  Failed to return ETH from ${wallet.address}: ${e}`));
        }
    }
};

const main = async () => {
    console.log(chalk.bold.blue("\n=== Deploy & Test MintableConfidentialToken ===\n"));

    [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    await deploy();
    await generateAndFundWallets();
    await depositEthForCallbacks();

    try {
        // Mints tokens to Deployer andDecrypts deployer's balance
        await testDecryptDeployerBalance();
        console.log();
        // Mints tokens to walletA and walletB
        await testMinting();
        console.log();

        // Transfer deployer → walletA, capture & verify callback events
        const { txId, transferData } = await testTransferAndEvents();
        console.log();

        // We can now test historic decryption of this transfer

        await testHistoricDecryption(txId, transferData);
        console.log();
        console.log(chalk.bold.green("\n=== SUCCESS ===\n"));

    } catch (error) {
        console.error(chalk.red("\n=== Test execution failed ==="));
        console.error(error);
        process.exitCode = 1;
    } finally {
        await cleanup();
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
