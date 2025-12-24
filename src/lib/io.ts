import { z } from 'zod';
import yaml from 'js-yaml';

// --- 1. Primitives ---

const MetadataSchema = z.array(z.record(z.string(), z.string())).transform((list) => {
  return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, string>);
}).optional();

const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()), 
]);

const PropertiesSchema = z.array(z.record(z.string(), PropertyValueSchema)).transform((list) => {
  return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof PropertyValueSchema>>);
}).optional();


// --- 2. Definition Schemas ---

const PropertyDefinitionSchema = z.object({
  type: z.string(),
  description: z.string().nullable().optional(),
  metadata: MetadataSchema,
  required: z.boolean().optional(),
  default_value: z.any().optional(),
});

// Artifact can have file as string OR object (e.g. { src: ..., dest: ... })
const ArtifactAssignmentSchema = z.record(z.string(), z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]));

// Operation can be a string (URI) or an object with various fields
const OperationDefinitionSchema = z.union([
  z.string().describe("Artifact URI string"),
  z.null(),
  z.object({
    description: z.string().nullable().optional(),
    metadata: MetadataSchema,
    artifacts: z.array(ArtifactAssignmentSchema).optional(),
  }).passthrough(), // Allow extra fields
]);


// --- 3. Component & Relation Types ---

const RelationTypeSchema = z.object({
  extends: z.string().optional(),
  description: z.string().nullable().optional(),
  metadata: MetadataSchema,
  properties: z.array(z.record(z.string(), PropertyDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof PropertyDefinitionSchema>>);
  }).optional(),
  operations: z.array(z.record(z.string(), OperationDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof OperationDefinitionSchema>>);
  }).optional(),
});

const ComponentTypeSchema = z.object({
  extends: z.string().optional(),
  description: z.string().nullable().optional(),
  metadata: MetadataSchema,
  properties: z.array(z.record(z.string(), PropertyDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof PropertyDefinitionSchema>>);
  }).optional(),
  operations: z.array(z.record(z.string(), OperationDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof OperationDefinitionSchema>>);
  }).optional(),
});


// --- 4. Assignments ---

// Root-level relation assignment (with source and target)
const RootRelationAssignmentSchema = z.object({
  type: z.string(),
  description: z.string().nullable().optional(),
  source: z.string(),
  target: z.string(),
  metadata: MetadataSchema,
  properties: PropertiesSchema,
  operations: z.array(z.record(z.string(), OperationDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof OperationDefinitionSchema>>);
  }).optional(),
});

const ComponentAssignmentSchema = z.object({
  type: z.string(),
  description: z.string().nullable().optional(),
  metadata: MetadataSchema,
  properties: PropertiesSchema, 
  operations: z.array(z.record(z.string(), OperationDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof OperationDefinitionSchema>>);
  }).optional(),
  artifacts: z.array(ArtifactAssignmentSchema).optional(),
});


// --- 5. Root Deployment Model ---

export const EdmmSchema = z.object({
  version: z.string().optional(),
  description: z.string().nullable().optional(),
  metadata: MetadataSchema,
  
  properties: z.array(z.record(z.string(), PropertyDefinitionSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof PropertyDefinitionSchema>>);
  }).optional(),
  
  relation_types: z.array(z.record(z.string(), RelationTypeSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof RelationTypeSchema>>);
  }).optional(),
  
  component_types: z.array(z.record(z.string(), ComponentTypeSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof ComponentTypeSchema>>);
  }).optional(),
  
  components: z.array(z.record(z.string(), ComponentAssignmentSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof ComponentAssignmentSchema>>);
  }),
  
  relations: z.array(z.record(z.string(), RootRelationAssignmentSchema)).transform((list) => {
    return list.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, z.infer<typeof RootRelationAssignmentSchema>>);
  }).optional(),
});


// --- 6. Exports ---

export type EdmmDeploymentModel = z.infer<typeof EdmmSchema>;
export type ComponentAssignment = z.infer<typeof ComponentAssignmentSchema>;
export type RelationAssignment = z.infer<typeof RootRelationAssignmentSchema>;

export interface ValidationResult {
  success: boolean;
  data?: EdmmDeploymentModel;
  errors?: string[];
}

export function validateEdmmModel(rawJson: unknown): ValidationResult {
  const result = EdmmSchema.safeParse(rawJson);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const formattedErrors = result.error.issues.map((issue) => {
      const path = issue.path.join(" -> ");
      return `Error at [${path}]: ${issue.message}`;
    });
    return { success: false, errors: formattedErrors };
  }
}

export function parseAndValidateEdmm(yamlContent: string) {
  let rawObj;
  try {
    rawObj = yaml.load(yamlContent);
    console.log('rawObj', rawObj);
  } catch (e: any) {
    return { success: false, errors: [`YAML Syntax Error: ${e.message}`] };
  }
  return validateEdmmModel(rawObj);
}
