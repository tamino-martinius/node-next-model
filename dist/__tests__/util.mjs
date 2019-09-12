export const it = test;
export const context = (description, { definitions, tests, reset }) => {
    describe(description, () => {
        beforeEach(definitions);
        tests();
        if (reset !== undefined) {
            afterEach(reset);
        }
    });
};
export function randomInteger(min, max) {
    return Math.max(min, Math.min(max, Math.round(Math.random() * (max - min))));
}
//# sourceMappingURL=util.mjs.map