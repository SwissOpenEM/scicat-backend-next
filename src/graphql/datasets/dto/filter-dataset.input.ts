/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputType, Field, registerEnumType } from "@nestjs/graphql";
import GraphQLJSON from "graphql-type-json";
import GraphQLScalarType from "graphql-type-json";
import { ScientificRelation } from "src/common/scientific-relation.enum";

@InputType()
export class LimitsInputType {
  @Field(() => Number)
  limit: number;

  @Field(() => Number)
  skip: number;

  @Field(() => String)
  order: string;
}

@InputType()
class DateRangeInput {
  @Field()
  begin: string;

  @Field()
  end: string;
}

@InputType()
class ScientificFilterInput {
  @Field()
  lhs: string;

  @Field()
  relation: ScientificRelation;

  @Field(() => GraphQLScalarType)
  rhs: string | number;

  @Field({ nullable: true })
  unit?: string;
}

registerEnumType(ScientificRelation, {
  name: "ScientificRelation",
});

@InputType()
export class FieldsInputType {
  @Field(() => GraphQLJSON, { nullable: true })
  mode?: Record<string, unknown>;

  @Field({ nullable: true })
  text?: string;

  @Field(() => DateRangeInput, { nullable: true })
  creationTime?: DateRangeInput;

  @Field(() => [String], { nullable: true })
  type?: string[];

  @Field(() => [String], { nullable: true })
  creationLocation?: string[];

  @Field(() => [String], { nullable: true })
  ownerGroup?: string[];

  @Field(() => [String], { nullable: true })
  accessGroups?: string[];

  @Field(() => [String], { nullable: true })
  keywords?: string[];

  @Field(() => Boolean, { nullable: true })
  isPublished?: boolean;

  @Field(() => [ScientificFilterInput], { nullable: true })
  scientific?: ScientificFilterInput[];

  @Field({ nullable: true })
  metadataKey?: string;

  @Field({ nullable: true })
  _id?: string;

  @Field(() => [String], { nullable: true })
  userGroups?: string[];

  @Field({ nullable: true })
  sharedWith?: string;
}

@InputType()
export class FiltersInputType {
  @Field(() => String, { nullable: true })
  fields?: string;

  @Field(() => String, { nullable: true })
  limits?: string;
}
