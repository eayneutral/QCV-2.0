-- NeonDB Initialization Script for QCV-2.0
-- This SQL script creates all necessary tables and relationships
-- Run this in the NeonDB SQL Editor to activate your database

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create User table
CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
  "tenantId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create AuditLog table
CREATE TABLE "AuditLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  action TEXT NOT NULL,
  ip TEXT,
  device TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Create Authenticator table
CREATE TABLE "Authenticator" (
  "credentialID" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "credentialPublicKey" BYTEA NOT NULL,
  counter INTEGER NOT NULL,
  "credentialDeviceType" TEXT NOT NULL,
  "credentialBackedUp" BOOLEAN NOT NULL,
  transports TEXT,
  CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Create MagicLink table
CREATE TABLE "MagicLink" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Create Vault table
CREATE TABLE "Vault" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  "encryptedData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Create VaultVersion table
CREATE TABLE "VaultVersion" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "vaultId" TEXT NOT NULL,
  "encryptedData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultVersion_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"(id) ON DELETE CASCADE
);

-- Create Session table
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Create RecoveryCode table
CREATE TABLE "RecoveryCode" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

-- Create GlobalSetting table
CREATE TABLE "GlobalSetting" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Create CustomRole table
CREATE TABLE "CustomRole" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "Authenticator_userId_idx" ON "Authenticator"("userId");
CREATE INDEX "MagicLink_userId_idx" ON "MagicLink"("userId");
CREATE INDEX "MagicLink_token_idx" ON "MagicLink"(token);
CREATE INDEX "Vault_userId_idx" ON "Vault"("userId");
CREATE INDEX "Vault_category_idx" ON "Vault"(category);
CREATE INDEX "VaultVersion_vaultId_idx" ON "VaultVersion"("vaultId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_token_idx" ON "Session"(token);
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- Insert default global settings (optional)
INSERT INTO "GlobalSetting" (key, value) VALUES 
  ('app_version', '1.0.0'),
  ('features_enabled', '{"mfa": true, "magic_links": true, "vault_versioning": true}')
ON CONFLICT (key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE "User" IS 'Core user account table with authentication and subscription info';
COMMENT ON TABLE "Vault" IS 'Encrypted credential storage with AES-256-GCM encryption';
COMMENT ON TABLE "Session" IS 'Active user sessions with expiration tracking';
COMMENT ON TABLE "AuditLog" IS 'Security audit trail for user actions';
