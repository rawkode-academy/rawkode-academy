use crate::utils::find_hcl_files;
use hcl::{format::Formatter, ser::Serializer};
use miette::Result;
use std::{
    fs::{read_to_string, write},
    path::PathBuf,
};

pub fn command(path: PathBuf, apply: bool) -> Result<()> {
    let files = find_hcl_files(path)?;

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

                        if let Some(object) = object.as_block() {
                            if ser.serialize(object).is_err() {
                                eprintln!("{} - Failed to serialize HCL", file.display());
                                return;
                            };
                        }

                        if let Ok(formatted) = String::from_utf8(writer) {
                            if content.eq(&formatted) {
                                println!("{} - OK", file.display());
                                return;
                            }

                            if apply {
                                let _ = write(&file, formatted);
                                println!("{} - FIXED", file.display())
                            } else {
                                println!("{} - NEEDS FIX", file.display())
                            }
                        } else {
                            eprintln!("{} - Failed to serialize HCL", file.display());
                        }
                    });
                }
                Err(_) => eprintln!("{} - Failed to parse HCL", file.display()),
            };
        }
    }

    Ok(())
}
