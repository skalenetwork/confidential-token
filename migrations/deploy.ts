export const contracts = [
    "ConfidentialToken"
];

const main = async () => {
    throw new Error("Not implemented");
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
