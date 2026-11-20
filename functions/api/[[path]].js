import api from "../../worker/index.js";

export async function onRequest(context) {
  return api.fetch(context.request, context.env, context);
}
