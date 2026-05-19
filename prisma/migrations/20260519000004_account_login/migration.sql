ALTER TABLE "User" RENAME COLUMN "email" TO "account";

ALTER INDEX "User_email_key" RENAME TO "User_account_key";
