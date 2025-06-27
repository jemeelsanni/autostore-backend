import express from 'express';
import { PrismaClient } from '@prisma/client';
declare const app: import("express-serve-static-core").Express;
export declare const prisma: PrismaClient<{
    log: ("error" | "query" | "warn")[];
    errorFormat: "pretty";
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export { app, express };
//# sourceMappingURL=index.d.ts.map