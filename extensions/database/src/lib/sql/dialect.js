const FAMILY = { d1: "sqlite" };

export function dialectOf(engine) {
    return FAMILY[engine] || engine;
}
