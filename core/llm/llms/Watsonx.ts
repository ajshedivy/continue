/* eslint-disable @typescript-eslint/naming-convention */
import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class Watsonx extends BaseLLM {
  static providerName: ModelProvider = "watsonx";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      n_predict: options.maxTokens,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      min_p: options.minP,
      mirostat: options.mirostat,
      stop: options.stop,
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`
    };

    let inputBody: string[] = [];
    const roleLabel = "user";
    inputBody.push(`<|${roleLabel}|>\n${prompt}\n`);
    inputBody.push("<|assistant|>\n");

    const body = {
      // input: "<|system|>\nYou are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'\''day, morning, afternoon, evening, night, what'\''s up, nice to meet you, sup, etc) with \"Hello! I am Granite Chat, created by IBM. How can I help you today?\". Please do not say anything else and do not start a conversation.\n<|user|>\n${userInput}\n<|assistant|>\n",
      input: inputBody.join(""),
      parameters: {
        decoding_method: "greedy",
        max_new_tokens: 900,
        min_new_tokens: 0,
        stop_sequences: [],
        repetition_penalty: 1.05
      },
      model_id: options.model,
      project_id: "790743a6-e2cc-40ee-b587-03fe9c87358c"
    };

    const response = await this.fetch(new URL(this.apiBase ?? ""), {
      method: "POST",
      headers, 
      body: JSON.stringify({
        body,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get response from WatsonX. (${response.status})`);
    }

    const asJson = await response.json() as any;

    if (asJson.results && Array.isArray(asJson.results)) {
      for await (const result of streamSse(response)) {
        if (result.content) {
          yield result.content;
        }
      }
    }

  }



}

export default Watsonx;