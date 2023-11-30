import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { DatasetsModule } from "src/datasets/datasets.module";
import { DatasetsResolver } from "./datasets/datasets.resolver";
import { CaslAbilityFactory } from "src/casl/casl-ability.factory";

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, // or use 'true' for in-memory schema
    }),
    DatasetsModule,
  ],
  providers: [CaslAbilityFactory, DatasetsResolver], // Add your resolver here
})
export class GraphqlModule {}
