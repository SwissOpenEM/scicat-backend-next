/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectType, Field, ID, registerEnumType } from "@nestjs/graphql";
import { DatasetType as DatasetTypeEnum } from "../../../datasets/dataset-type.enum";
import GraphQLJSON from "graphql-type-json";

registerEnumType(DatasetTypeEnum, {
  name: "DatasetTypeEnum",
});

@ObjectType()
export class DatasetType {
  @Field(() => ID)
  pid: string;

  @Field()
  owner: string;

  @Field({ nullable: true })
  ownerEmail?: string;

  @Field()
  contactEmail: string;

  @Field(() => [String], { nullable: true })
  accessGroups?: string[];

  @Field({ nullable: true })
  isPublished: boolean;

  @Field()
  sourceFolder: string;

  @Field({ nullable: true })
  sourceFolderHost?: string;

  @Field()
  size: number;

  @Field({ nullable: true })
  packedSize?: number;

  @Field({ nullable: true })
  numberOfFiles: number;

  @Field({ nullable: true })
  numberOfFilesArchived: number;

  @Field(() => Date)
  creationTime: Date;

  @Field(() => DatasetType)
  type: DatasetType;

  @Field({ nullable: true })
  validationStatus?: string;

  @Field(() => [String])
  keywords: string[];

  @Field({ nullable: true })
  description?: string;

  @Field(() => GraphQLJSON)
  datasetName?: any;

  @Field(() => GraphQLJSON)
  classification?: any;

  @Field(() => GraphQLJSON)
  license?: any;

  @Field(() => GraphQLJSON)
  version?: any;

  @Field(() => GraphQLJSON)
  history?: any;

  @Field(() => GraphQLJSON)
  datasetlifecycle?: any;

  @Field(() => GraphQLJSON)
  techniques?: any;

  @Field(() => GraphQLJSON)
  relationships?: any;

  @Field(() => GraphQLJSON)
  sharedWith?: any;

  @Field(() => GraphQLJSON)
  attachments?: any;

  @Field(() => GraphQLJSON)
  origdatablocks: any;

  @Field(() => GraphQLJSON)
  datablocks: any;

  @Field(() => GraphQLJSON)
  scientificMetadata?: any;

  @Field(() => GraphQLJSON)
  comment?: any;

  @Field(() => Number)
  dataQualityMetrics: number;

  @Field(() => GraphQLJSON)
  principalInvestigator?: any;

  @Field(() => Date)
  endTime?: Date;

  @Field(() => GraphQLJSON)
  creationLocation?: any;

  @Field(() => GraphQLJSON)
  dataFormat?: any;

  @Field({ nullable: true })
  proposalId?: string;

  @Field(() => GraphQLJSON)
  sampleId?: any;

  @Field(() => GraphQLJSON)
  instrumentId?: any;

  @Field(() => GraphQLJSON)
  investigator?: any;

  @Field(() => GraphQLJSON)
  inputDatasets?: any;

  @Field(() => GraphQLJSON)
  usedSoftware?: any;

  @Field(() => GraphQLJSON)
  jobParameters?: any;

  @Field(() => GraphQLJSON)
  jobLogData?: any;
}
