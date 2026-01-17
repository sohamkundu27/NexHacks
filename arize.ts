import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
        ["openinference.project.name"]: "your-project-name",
    }),
    spanProcessors: [
    new SimpleSpanProcessor(
        new OTLPTraceExporter({
            url: "https://otlp.arize.com/v1/traces",
            headers: {
                'space_id': 'U3BhY2U6MzYwNjQ6VEEySA==',
                'api_key': process.env.ARIZE_API_KEY!,
            },
        }),
        ),
    ],
});

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);
registerInstrumentations({ instrumentations: [instrumentation] });
provider.register();