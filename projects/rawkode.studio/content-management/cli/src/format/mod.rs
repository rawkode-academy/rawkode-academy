use crate::utils::find_hcl_files;
use hcl::{format::Formatter, ser::Serializer};
use miette::{IntoDiagnostic, Result};
use std::{
    fs::{read_to_string, write},
    path::PathBuf,
};

pub fn command(path: PathBuf, apply: bool) -> Result<()> {
    let files = find_hcl_files(path);

    println!("Formatting {} files", files.len());
    println!();

    for file in files {
        if let Ok(content) = read_to_string(&file) {
            match hcl::from_str::<hcl::Body>(&content) {
                Ok(value) => {
                    value.into_iter().for_each(|object| {
                        let mut writer = Vec::new();
                        let formatter = Formatter::builder()
                            .indent(b"  ")
                            .dense(false)
                            .compact(false)
                            .compact_arrays(false)
                            .compact_objects(false)
                            .prefer_ident_keys(true)
                            .build(&mut writer);

                        let mut ser = Serializer::with_formatter(formatter);

                        ser.serialize(object.as_block().unwrap()).unwrap();

                        let formatted = String::from_utf8(writer).unwrap();

                        if content.eq(&formatted) {
                            return;
                        }

                        if apply {
                            let _ = write(&file, formatted).into_diagnostic();
                            println!("{} - FIXED", file.display())
                        } else {
                            println!("{} - NEEDS FIX", file.display())
                        }
                    });
                }
                Err(_) => eprintln!("{} - Failed to parse HCL", file.display()),
            };
        }
    }

    Ok(())
}
