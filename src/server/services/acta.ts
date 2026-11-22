import { AppError } from "@/lib/result";
import { MAX_BYTES } from "../files/file-store";

/** Lee un archivo subido (File de un formulario) como bytes, rechazando lo evidentemente excesivo. */
export async function leerActa(valor: FormDataEntryValue | null): Promise<Uint8Array> {
  if (!(valor instanceof File) || valor.size === 0) {
    throw new AppError("ACTA_INVALIDA", "Adjunte el acta de designación (PDF o imagen).", "acta");
  }
  if (valor.size > MAX_BYTES) throw new AppError("ACTA_INVALIDA", undefined, "acta");
  return new Uint8Array(await valor.arrayBuffer());
}
