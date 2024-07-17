/* eslint-disable @typescript-eslint/naming-convention */
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { BaseLLM } from "../index.js";
import { streamJSON, streamResponse, streamSse } from "../stream.js";

class Watsonx extends BaseLLM {
  static providerName: ModelProvider = "watsonx";
  static defaultOptions: Partial<LLMOptions> = {};

  constructor(options: LLMOptions) {
    super(options);
    this.apiBase = `https://${options.clusterUrl}/ml/v1/text/generation_stream?version=2023-05-29`;
    this.projectId = options.spaceId;
  }

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
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const accessToken = await this.getAccessToken(this.apiKey);
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    let inputBody: string[] = [];
    const roleLabel = "user";
    inputBody.push(
      "<|system|>\nYou are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'''day, morning, afternoon, evening, night, what'''s up, nice to meet you, sup, etc) with \"Hello! I am Granite Chat, created by IBM. How can I help you today?\". Please do not say anything else and do not start a conversation.\n",
    );
    inputBody.push(`<|${roleLabel}|>\n${prompt}\n`);
    inputBody.push("<|assistant|>\n");

    const body = {
      input: inputBody.join(""),
      parameters: {
        decoding_method: "greedy",
        max_new_tokens: 900,
        min_new_tokens: 0,
        stop_sequences: ["<|im_end|>"],
        include_stop_sequence: false,
        repetition_penalty: 1.05,
      },
      model_id: options.model,
      project_id: this.projectId,
      stream: true,
    };

    const response = await this.fetch(this.apiBase ?? "", {
      headers,
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get response from WatsonX. (${response.status})`,
      );
    }
    let buffer = "";
    for await (const value of streamSse(response)) {
      if (value.results) {
        for (const result of value.results) {
          yield result.generated_text;
        }
      }
    }
  }

  async getAccessToken(apiKey: string = "") {
    if (apiKey) {
      try {
        // curl -X POST 'https://iam.cloud.ibm.com/identity/token' -H 'Content-Type: application/x-www-form-urlencoded' -d 'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=MY_APIKEY'
        const iamResult = await fetch(
          `https://iam.cloud.ibm.com/identity/token`,
          {
            headers: {
              "Content-Type": `application/x-www-form-urlencoded`,
            },
            method: `POST`,
            body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
          },
        );

        if (iamResult.ok) {
          const iamJson = (await iamResult.json()) as any;
          const accessToken = iamJson.access_token;
          if (accessToken) {
            return accessToken;
          }
        }
      } catch (e) {
        throw new Error(`Failed to get access token from IBM IAM: ${e}`);
      }
    }
  }
}

export default Watsonx;
