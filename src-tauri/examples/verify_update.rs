use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert_eq!(
        args.len(),
        4,
        "usage: verify_update public.key package package.sig"
    );
    let public = String::from_utf8(
        STANDARD
            .decode(std::fs::read_to_string(&args[1]).unwrap().trim())
            .unwrap(),
    )
    .unwrap();
    let signature = String::from_utf8(
        STANDARD
            .decode(std::fs::read_to_string(&args[3]).unwrap().trim())
            .unwrap(),
    )
    .unwrap();
    let key = PublicKey::decode(&public).unwrap();
    let sig = Signature::decode(&signature).unwrap();
    let mut bytes = std::fs::read(&args[2]).unwrap();
    key.verify(&bytes, &sig, true)
        .expect("Invalid updater signature");
    bytes[0] ^= 1;
    assert!(
        key.verify(&bytes, &sig, true).is_err(),
        "Tampered payload accepted"
    );
    println!("PASS: valid signature verified; tampered package rejected");
}
