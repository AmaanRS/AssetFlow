import { prisma } from "../database/prisma.js";

const mysqlSignedIntMaximum = 2147483647;
const transactionRetryLimit = 3;

/**
 * Runs `work` inside a Serializable transaction, retrying a limited number of
 * times when MySQL reports a serialization failure (Prisma error P2034).
 */
async function runSerializableTransaction(work) {
  for (let attempt = 1; attempt <= transactionRetryLimit; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === transactionRetryLimit) {
        throw error;
      }
    }
  }

  throw new Error("Unable to complete the transaction.");
}

export { mysqlSignedIntMaximum, runSerializableTransaction, transactionRetryLimit };
