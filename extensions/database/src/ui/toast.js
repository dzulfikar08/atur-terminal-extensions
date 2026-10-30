export async function toast(body, variant = "info") {
    await atur.toast({ body, variant }).catch(() => undefined);
}
