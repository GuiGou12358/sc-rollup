import { hasher } from "@polkadot/util-crypto/secp256k1/hasher"
import { GetKeyResponse } from "@phala/dstack-sdk"
import { Keyring } from "@polkadot/keyring"

/**
 * Creates a seed from GetKeyResponse using secure key derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function computePrivateKey(keyResponse: GetKeyResponse) {
  return hasher("blake2", keyResponse.key)
}

/**
 * Creates a Substrate Keypair (sr25519) from GetKeyResponse using secure key
 * derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function toKeypair(keyResponse: GetKeyResponse) {
  const seed = computePrivateKey(keyResponse)
  return new Keyring({ type: "sr25519" }).addFromSeed(seed)
}

/**
 * Creates an Ecdsa Keypair from GetKeyResponse using secure key derivation.
 * This method applies blake2 hashing to the complete key material for enhanced
 * security.
 */
export function toEcdsaKeypair(keyResponse: GetKeyResponse) {
  const seed = computePrivateKey(keyResponse)
  return new Keyring({ type: "ecdsa" }).addFromSeed(seed)
}
