use core::fmt;
use std::io::{BufRead, Write};

use crate::bitcoin::encoding::{Decodable, Encodable};

use super::hash::Hash;
use borsh::{BorshDeserialize, BorshSerialize};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(
    Debug,
    Copy,
    Clone,
    Eq,
    PartialEq,
    Serialize,
    Deserialize,
    BorshSerialize,
    BorshDeserialize,
    JsonSchema,
)]
#[serde(crate = "near_sdk::serde")]
pub struct Txid(pub Hash);

impl Txid {
    pub const fn as_byte_array(&self) -> [u8; 32] {
        self.0.as_byte_array()
    }
}

impl Txid {
    /// The "all zeros" TXID.
    ///
    /// This is used as the "txid" of the dummy input of a coinbase transaction. It is
    /// not a real TXID and should not be used in other contexts.
    pub const fn all_zeros() -> Self {
        Self(Hash::all_zeros())
    }
}

impl Encodable for Txid {
    fn encode<W: Write + ?Sized>(&self, w: &mut W) -> Result<usize, std::io::Error> {
        self.0.encode(w)
    }
}

impl Decodable for Txid {
    fn decode<R: BufRead + ?Sized>(r: &mut R) -> Result<Self, std::io::Error> {
        Decodable::decode(r).map(Txid)
    }
}

impl fmt::Display for Txid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode() {
        let txid = Txid::all_zeros();
        let mut buf = Vec::new();

        assert_eq!(txid.encode(&mut buf).unwrap(), 32);
        assert_eq!(Txid::decode(&mut buf.as_slice()).unwrap(), txid);
    }
}
