/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MongoError } from "mongodb";
import { Query, Resolver, Mutation, Args, Context } from "@nestjs/graphql";
import { Request } from "express";
import { AppAbility } from "src/casl/casl-ability.factory";
import { CheckPolicies } from "src/casl/decorators/check-policies.decorator";
import { PoliciesGuard } from "src/casl/guards/policies.guard";
import { DatasetsService } from "src/datasets/datasets.service";
import { SubDatasetsPublicInterceptor } from "src/datasets/interceptors/datasets-public.interceptor";
import { FullQueryInterceptor } from "src/datasets/interceptors/fullquery.interceptor";
import { Action } from "src/casl/action.enum";
import { DatasetClass } from "src/datasets/schemas/dataset.schema";
import { FiltersInputType } from "./dto/filter-dataset.input";
import { DatasetType } from "./entities/datasets.entity";
import { FormatPhysicalQuantitiesInterceptor } from "src/common/interceptors/format-physical-quantities.interceptor";
import { UTCTimeInterceptor } from "src/common/interceptors/utc-time.interceptor";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { CreateDerivedDatasetDto } from "src/datasets/dto/create-derived-dataset.dto";
import { CreateRawDatasetDto } from "src/datasets/dto/create-raw-dataset.dto";
import {
  PartialUpdateDerivedDatasetDto,
  UpdateDerivedDatasetDto,
} from "src/datasets/dto/update-derived-dataset.dto";
import {
  PartialUpdateRawDatasetDto,
  UpdateRawDatasetDto,
} from "src/datasets/dto/update-raw-dataset.dto";
import { validate, ValidationError, ValidatorOptions } from "class-validator";
// import { CreateDatasetDto } from "./dto/create-dataset.input";
import GraphQLJSON from "graphql-type-json";

@Resolver()
export class DatasetsResolver {
  constructor(private datasetsService: DatasetsService) {}

  // ********************************
  // *********** QUERY ***********
  // ********************************

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @UseInterceptors(SubDatasetsPublicInterceptor, FullQueryInterceptor)
  @Query(() => [DatasetType], { nullable: true })
  async datasets(
    @Context() context: any,
    @Args("filters", { type: () => FiltersInputType, nullable: true })
    filters?: { fields?: string; limits?: string },
  ) {
    const request: Request = context.req;

    const parsedFilters: any = {
      fields: JSON.parse(filters?.fields ?? "{}"),
      limits: JSON.parse(filters?.limits ?? "{}"),
    };

    return this.datasetsService.fullquery(parsedFilters);
  }
  // ********************************
  // *********** MUTATION ***********
  // ********************************

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.DatasetCreate, DatasetClass),
  )
  @UseInterceptors(
    new UTCTimeInterceptor<DatasetClass>(["creationTime"]),
    new UTCTimeInterceptor<DatasetClass>(["endTime"]),
    new FormatPhysicalQuantitiesInterceptor<DatasetClass>("scientificMetadata"),
  )
  @Mutation(() => DatasetType)
  async createDataset(
    @Context() context: any,
    @Args("createDatasetDto", { type: () => GraphQLJSON })
    createDatasetDto: any,
  ) {
    try {
      const createdDataset = await this.datasetsService.create(
        createDatasetDto as any,
      );

      return createdDataset;
    } catch (error) {
      if ((error as MongoError).code === 11000) {
        throw new ConflictException(
          "A dataset with this this unique key already exists!",
        );
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async validateDataset(
    inputDatasetDto:
      | CreateRawDatasetDto
      | CreateDerivedDatasetDto
      | PartialUpdateRawDatasetDto
      | PartialUpdateDerivedDatasetDto
      | UpdateRawDatasetDto
      | UpdateDerivedDatasetDto,
    dto: ClassConstructor<
      | CreateRawDatasetDto
      | CreateDerivedDatasetDto
      | PartialUpdateRawDatasetDto
      | PartialUpdateDerivedDatasetDto
      | UpdateRawDatasetDto
      | UpdateDerivedDatasetDto
    >,
  ) {
    const type = inputDatasetDto.type;
    const validateOptions: ValidatorOptions = {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: {
        value: false,
        target: false,
      },
    };

    if (type !== "raw" && type !== "derived") {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          message: "Wrong dataset type!",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const outputDatasetDto = plainToInstance(dto, inputDatasetDto);
    const errors = await validate(outputDatasetDto, validateOptions);

    if (errors.length > 0) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          message: JSON.stringify(errors),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return outputDatasetDto;
  }
}
