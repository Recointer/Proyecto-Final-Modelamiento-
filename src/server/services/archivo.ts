import { AppError } from "@/lib/result";
import { MAX_BYTES } from "../files/file-store";

/**
 * Lee un archivo opcional de un formulario: devuelve null si no se adjuntó nada. El tipo real
 * (PNG o JPEG) lo valida el FileStore por firma al guardar.
 */
export async function leerArchivoOpcional(
  valor: FormDataEntryValue | null,
  codigoError = "IMAGEN_INVALIDA",
  campo = "imagen",
): Promise<Uint8Array | null> {
  if (!(valor instanceof File) || valor.size === 0) return null;
  if (valor.size > MAX_BYTES) throw new AppError(codigoError, "El archivo debe pesar entre 1 byte y 5 MB.", campo);
  return new Uint8Array(await valor.arrayBuffer());
}
