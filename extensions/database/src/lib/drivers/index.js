import { sqlite } from "./sqlite.js";
import { postgres } from "./postgres.js";
import { mysql, mariadb } from "./mysql.js";
import { d1 } from "./d1.js";

const registry = { sqlite, d1, postgres, mysql, mariadb };

export function getDriver(engine) {
    const driver = registry[engine];
    if (!driver)
        throw new Error(`Unsupported engine: ${engine}`);
    return driver;
}
