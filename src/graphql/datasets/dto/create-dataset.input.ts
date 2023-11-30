/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputType, Field, ID, registerEnumType } from "@nestjs/graphql";
import { DatasetType } from "../../../datasets/dataset-type.enum";
import GraphQLJSON from "graphql-type-json";

@InputType()
class TechniqueClass {
  @Field(() => ID)
  pid: string;
  @Field()
  name: string;
}

@InputType()
class RelationshipClass {
  @Field(() => ID)
  pid: string;
  @Field()
  relationship: string;
}

// @InputType()
// export class CreateDatasetDto {
//   @Field(() => GraphQLJSON)
//   data: any;
// }

// @InputType()
// export class CreateDatasetDto {
//   @Field(() => ID, { nullable: true })
//   pid?: string;

//   @Field()
//   readonly owner: string;

//   @Field()
//   readonly ownerGroup: string;

//   @Field({ nullable: true })
//   readonly ownerEmail?: string;

//   @Field({ nullable: true })
//   readonly orcidOfOwner?: string;

//   @Field()
//   readonly contactEmail: string;

//   @Field()
//   readonly sourceFolder: string;

//   @Field({ nullable: true })
//   readonly sourceFolderHost?: string;

//   @Field(() => Number, { nullable: true })
//   readonly size?: number;

//   @Field(() => Number, { nullable: true })
//   readonly packedSize?: number;

//   @Field(() => Number, { nullable: true })
//   readonly numberOfFiles?: number;

//   @Field(() => Number, { nullable: true })
//   readonly numberOfFilesArchived?: number;

//   @Field()
//   readonly creationTime: Date;

//   @Field(() => DatasetType)
//   readonly type: DatasetType;

//   @Field({ nullable: true })
//   readonly validationStatus?: string;

//   @Field(() => [String], { nullable: true })
//   readonly keywords?: string[];

//   @Field({ nullable: true })
//   readonly description?: string;

//   @Field({ nullable: true })
//   readonly datasetName?: string;

//   @Field({ nullable: true })
//   readonly classification?: string;

//   @Field({ nullable: true })
//   readonly license?: string;

//   @Field({ nullable: true })
//   readonly version?: string;

//   @Field(() => Boolean, { nullable: true })
//   readonly isPublished?: boolean;

//   @Field(() => [TechniqueClass], { nullable: true })
//   readonly techniques?: TechniqueClass[];

//   @Field(() => [RelationshipClass], { nullable: true })
//   readonly relationships?: RelationshipClass[];

//   @Field(() => GraphQLJSON, { nullable: true })
//   readonly datasetlifecycle: any;

//   @Field(() => GraphQLJSON, { nullable: true })
//   readonly scientificMetadata?: Record<string, unknown>;

//   @Field({ nullable: true })
//   readonly comment?: string;

//   @Field(() => Number, { nullable: true })
//   readonly dataQualityMetrics?: number;
// }
