import { hasher } from "@polkadot/util-crypto/secp256k1/hasher"
import { DeriveKeyResponse } from "@phala/dstack-sdk"
import { Keyring } from "@polkadot/keyring"

/**
 * Creates a seed from DeriveKeyResponse using secure key derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function computePrivateKey(deriveKeyResponse: DeriveKeyResponse) {
  return hasher("blake2", deriveKeyResponse.asUint8Array())
}

/**
 * Creates a Substrate Keypair (sr25519) from DeriveKeyResponse using secure key
 * derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function toKeypair(deriveKeyResponse: DeriveKeyResponse) {
  const seed = computePrivateKey(deriveKeyResponse)
  return new Keyring({ type: "sr25519" }).addFromSeed(seed)
}

/**
 * Creates an Ecdsa Keypair from DeriveKeyResponse using secure key derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function toEcdsaKeypair(deriveKeyResponse: DeriveKeyResponse) {
  const seed = computePrivateKey(deriveKeyResponse)
  return new Keyring({ type: "ecdsa" }).addFromSeed(seed)
}
