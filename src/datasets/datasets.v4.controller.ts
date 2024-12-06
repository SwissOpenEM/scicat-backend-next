import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Put,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  HttpException,
  NotFoundException,
  Req,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { DatasetsService } from "./datasets.service";
import { DatasetClass, DatasetDocument } from "./schemas/dataset.schema";
import { PoliciesGuard } from "src/casl/guards/policies.guard";
import { CheckPolicies } from "src/casl/decorators/check-policies.decorator";
import { AppAbility, CaslAbilityFactory } from "src/casl/casl-ability.factory";
import { Action } from "src/casl/action.enum";
import { IDatasetFields } from "./interfaces/dataset-filters.interface";
import {
  MainDatasetsPublicInterceptor,
  SubDatasetsPublicInterceptor,
} from "./interceptors/datasets-public.interceptor";
import { Attachment } from "src/attachments/schemas/attachment.schema";
import { CreateAttachmentDto } from "src/attachments/dto/create-attachment.dto";
import { AttachmentsService } from "src/attachments/attachments.service";
import { OrigDatablock } from "src/origdatablocks/schemas/origdatablock.schema";
import { OrigDatablocksService } from "src/origdatablocks/origdatablocks.service";
import { DatablocksService } from "src/datablocks/datablocks.service";
import { Datablock } from "src/datablocks/schemas/datablock.schema";
import { UpdateQuery } from "mongoose";
import { FilterPipe } from "src/common/pipes/filter.pipe";
import { UTCTimeInterceptor } from "src/common/interceptors/utc-time.interceptor";
import { FormatPhysicalQuantitiesInterceptor } from "src/common/interceptors/format-physical-quantities.interceptor";
import { IFacets, IFilters } from "src/common/interfaces/common.interface";
import { validate } from "class-validator";
import { HistoryInterceptor } from "src/common/interceptors/history.interceptor";

import {
  filterDescription,
  filterExample,
  replaceLikeOperator,
} from "src/common/utils";
import { HistoryClass } from "./schemas/history.schema";
import { TechniqueClass } from "./schemas/technique.schema";
import { RelationshipClass } from "./schemas/relationship.schema";
import { JWTUser } from "src/auth/interfaces/jwt-user.interface";
import { LogbooksService } from "src/logbooks/logbooks.service";
import { CreateDatasetDto } from "./dto/create-dataset.dto";
import {
  PartialUpdateDatasetDto,
  UpdateDatasetDto,
} from "./dto/update-dataset.dto";
import { Logbook } from "src/logbooks/schemas/logbook.schema";
import { OutputDatasetDto } from "./dto/output-dataset.dto";
import { ConfigService } from "@nestjs/config";
import {
  CountApiResponse,
  FullFacetFilters,
  FullFacetResponse,
  IsValidResponse,
} from "src/common/types";
import {
  DatasetLookupKeys,
  DATASET_LOOKUP_FIELDS,
} from "./types/dataset-lookup";

@ApiBearerAuth()
@ApiExtraModels(
  CreateAttachmentDto,
  CreateDatasetDto,
  HistoryClass,
  TechniqueClass,
  RelationshipClass,
)
@ApiTags("datasets")
@Controller({ path: "datasets", version: "4" })
export class DatasetsV4Controller {
  constructor(
    private attachmentsService: AttachmentsService,
    private datablocksService: DatablocksService,
    private datasetsService: DatasetsService,
    private origDatablocksService: OrigDatablocksService,
    private caslAbilityFactory: CaslAbilityFactory,
    private logbooksService: LogbooksService,
    private configService: ConfigService,
  ) {
    this.datasetCreationValidationEnabled = this.configService.get<boolean>(
      "datasetCreationValidationEnabled",
    );
    this.datasetCreationValidationRegex = this.configService.get<string>(
      "datasetCreationValidationRegex",
    );
  }

  private datasetCreationValidationEnabled;
  private datasetCreationValidationRegex;

  private validateDatasetPid(dataset: CreateDatasetDto) {
    // now checks if we need to validate the pid
    if (
      this.datasetCreationValidationEnabled &&
      this.datasetCreationValidationRegex &&
      dataset.pid
    ) {
      const re = new RegExp(this.datasetCreationValidationRegex);
      if (!re.test(dataset.pid)) {
        throw new BadRequestException(
          "PID is not following required standards",
        );
      }
    }
  }

  async generateDatasetInstanceForPermissions(
    dataset: DatasetClass | CreateDatasetDto,
  ): Promise<DatasetClass> {
    // NOTE: We need DatasetClass instance because casl module can not recognize the type from dataset mongo database model. If other fields are needed can be added later.
    const datasetInstance = new DatasetClass();
    datasetInstance._id = "";
    datasetInstance.pid = dataset.pid || "";
    datasetInstance.accessGroups = dataset.accessGroups || [];
    datasetInstance.ownerGroup = dataset.ownerGroup;
    datasetInstance.sharedWith = dataset.sharedWith;
    datasetInstance.isPublished = dataset.isPublished || false;

    return datasetInstance;
  }

  async checkPermissionsForDatasetExtended(
    request: Request,
    datasetInput: CreateDatasetDto | string | null,
    group: Action,
  ) {
    if (!datasetInput) {
      throw new NotFoundException(`dataset: ${datasetInput} not found`);
    }

    let dataset = null;

    if (typeof datasetInput === "string") {
      dataset = await this.datasetsService.findOne({
        where: { pid: datasetInput },
      });

      if (!dataset) {
        throw new NotFoundException(`dataset: ${datasetInput} not found`);
      }
    } else {
      dataset = datasetInput;
    }
    const user: JWTUser = request.user as JWTUser;

    const datasetInstance =
      await this.generateDatasetInstanceForPermissions(dataset);

    const ability = this.caslAbilityFactory.datasetInstanceAccess(user);

    let canDoAction = false;

    if (group == Action.DatasetRead) {
      canDoAction =
        ability.can(Action.DatasetReadAny, DatasetClass) ||
        ability.can(Action.DatasetReadOneOwner, datasetInstance) ||
        ability.can(Action.DatasetReadOneAccess, datasetInstance) ||
        ability.can(Action.DatasetReadOnePublic, datasetInstance);
    } else if (group == Action.DatasetCreate) {
      canDoAction =
        ability.can(Action.DatasetCreateAny, DatasetClass) ||
        ability.can(Action.DatasetCreateOwnerNoPid, datasetInstance) ||
        ability.can(Action.DatasetCreateOwnerWithPid, datasetInstance);
    } else if (group == Action.DatasetUpdate) {
      canDoAction =
        ability.can(Action.DatasetUpdateAny, DatasetClass) ||
        ability.can(Action.DatasetUpdateOwner, datasetInstance);
    } else if (group == Action.DatasetDelete) {
      canDoAction =
        ability.can(Action.DatasetDeleteAny, DatasetClass) ||
        ability.can(Action.DatasetDeleteOwner, datasetInstance);
    } else if (group == Action.DatasetAttachmentRead) {
      canDoAction =
        ability.can(Action.DatasetAttachmentReadAny, DatasetClass) ||
        ability.can(Action.DatasetAttachmentReadOwner, datasetInstance) ||
        ability.can(Action.DatasetAttachmentReadAccess, datasetInstance) ||
        ability.can(Action.DatasetAttachmentReadPublic, datasetInstance);
    } else if (group == Action.DatasetAttachmentCreate) {
      canDoAction =
        ability.can(Action.DatasetAttachmentCreateAny, DatasetClass) ||
        ability.can(Action.DatasetAttachmentCreateOwner, datasetInstance);
    } else if (group == Action.DatasetAttachmentUpdate) {
      canDoAction =
        ability.can(Action.DatasetAttachmentUpdateAny, DatasetClass) ||
        ability.can(Action.DatasetAttachmentUpdateOwner, datasetInstance);
    } else if (group == Action.DatasetAttachmentDelete) {
      canDoAction =
        ability.can(Action.DatasetAttachmentDeleteAny, DatasetClass) ||
        ability.can(Action.DatasetAttachmentDeleteOwner, datasetInstance);
    } else if (group == Action.DatasetOrigdatablockRead) {
      canDoAction =
        ability.can(Action.DatasetOrigdatablockReadAny, DatasetClass) ||
        ability.can(Action.DatasetOrigdatablockReadOwner, datasetInstance) ||
        ability.can(Action.DatasetOrigdatablockReadAccess, datasetInstance) ||
        ability.can(Action.DatasetOrigdatablockReadPublic, datasetInstance);
    } else if (group == Action.DatasetOrigdatablockCreate) {
      canDoAction =
        ability.can(Action.DatasetOrigdatablockCreateAny, DatasetClass) ||
        ability.can(Action.DatasetOrigdatablockCreateOwner, datasetInstance);
    } else if (group == Action.DatasetOrigdatablockUpdate) {
      canDoAction =
        ability.can(Action.DatasetOrigdatablockUpdateAny, DatasetClass) ||
        ability.can(Action.DatasetOrigdatablockUpdateOwner, datasetInstance);
    } else if (group == Action.DatasetOrigdatablockDelete) {
      canDoAction =
        ability.can(Action.DatasetOrigdatablockDeleteAny, DatasetClass) ||
        ability.can(Action.DatasetOrigdatablockDeleteOwner, datasetInstance);
    } else if (group == Action.DatasetDatablockRead) {
      canDoAction =
        ability.can(Action.DatasetOrigdatablockReadAny, DatasetClass) ||
        ability.can(Action.DatasetDatablockReadOwner, datasetInstance) ||
        ability.can(Action.DatasetDatablockReadAccess, datasetInstance) ||
        ability.can(Action.DatasetDatablockReadPublic, datasetInstance);
    } else if (group == Action.DatasetDatablockCreate) {
      canDoAction =
        ability.can(Action.DatasetDatablockCreateAny, DatasetClass) ||
        ability.can(Action.DatasetDatablockCreateOwner, datasetInstance);
    } else if (group == Action.DatasetDatablockUpdate) {
      canDoAction =
        ability.can(Action.DatasetDatablockUpdateAny, DatasetClass) ||
        ability.can(Action.DatasetDatablockUpdateOwner, datasetInstance);
    } else if (group == Action.DatasetDatablockDelete) {
      canDoAction =
        ability.can(Action.DatasetDatablockDeleteAny, DatasetClass) ||
        ability.can(Action.DatasetDatablockDeleteOwner, datasetInstance);
    } else if (group == Action.DatasetLogbookRead) {
      canDoAction =
        ability.can(Action.DatasetLogbookReadAny, DatasetClass) ||
        ability.can(Action.DatasetLogbookReadOwner, datasetInstance);
    }
    if (!canDoAction) {
      throw new ForbiddenException("Unauthorized access");
    }

    return dataset;
  }

  getFilters(
    headers: Record<string, string>,
    queryFilter: { filter?: string },
  ) {
    // NOTE: If both headers and query filters are present return error because we don't want to support this scenario.
    if (queryFilter?.filter && (headers?.filter || headers?.where)) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          message:
            "Using two different types(query and headers) of filters is not supported and can result with inconsistencies",
        },
        HttpStatus.BAD_REQUEST,
      );
    } else if (queryFilter?.filter) {
      const jsonQueryFilters: IFilters<DatasetDocument, IDatasetFields> =
        JSON.parse(queryFilter.filter);

      return jsonQueryFilters;
    } else if (headers?.filter) {
      const jsonHeadersFilters: IFilters<DatasetDocument, IDatasetFields> =
        JSON.parse(headers.filter);

      return jsonHeadersFilters;
    } else if (headers?.where) {
      const jsonHeadersWhereFilters: IFilters<DatasetDocument, IDatasetFields> =
        JSON.parse(headers.where);

      return jsonHeadersWhereFilters;
    }

    return {};
  }

  updateMergedFiltersForList(
    request: Request,
    mergedFilters: IFilters<DatasetDocument, IDatasetFields>,
  ): IFilters<DatasetDocument, IDatasetFields> {
    const user: JWTUser = request.user as JWTUser;

    const ability = this.caslAbilityFactory.datasetInstanceAccess(user);
    const canViewAny = ability.can(Action.DatasetReadAny, DatasetClass);
    const canViewOwner = ability.can(Action.DatasetReadManyOwner, DatasetClass);
    const canViewAccess = ability.can(
      Action.DatasetReadManyAccess,
      DatasetClass,
    );
    const canViewPublic = ability.can(
      Action.DatasetReadManyPublic,
      DatasetClass,
    );

    if (!mergedFilters.where) {
      mergedFilters.where = {};
    }

    if (!canViewAny) {
      if (canViewAccess) {
        mergedFilters.where["$or"] = [
          { ownerGroup: { $in: user.currentGroups } },
          { accessGroups: { $in: user.currentGroups } },
          { sharedWith: { $in: user.email } },
          { isPublished: true },
        ];
      } else if (canViewOwner) {
        mergedFilters.where = [{ ownerGroup: { $in: user.currentGroups } }];
      } else if (canViewPublic) {
        mergedFilters.where = { isPublished: true };
      }
    }

    return mergedFilters;
  }

  getIncludeFilters(
    includeFilters: IFilters<DatasetDocument, IDatasetFields>["include"],
  ) {
    // Check if the includeFilters contains the right values from DATASET_LOOKUP_FIELDS for including the right relations on the Dataset
    return includeFilters
      ?.map((field) => {
        if (Object.keys(DATASET_LOOKUP_FIELDS).includes(field.relation)) {
          return field.relation;
        } else {
          throw new BadRequestException(
            `Provided include field ${JSON.stringify(field)} is not part of the dataset relations`,
          );
        }
      })
      .filter((field): field is DatasetLookupKeys => !!field);
  }

  // POST /api/v4/datasets
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetCreate, DatasetClass),
  )
  @UseInterceptors(
    new UTCTimeInterceptor<DatasetClass>(["creationTime"]),
    new UTCTimeInterceptor<DatasetClass>(["endTime"]),
    new FormatPhysicalQuantitiesInterceptor<DatasetClass>("scientificMetadata"),
  )
  @Post()
  @ApiOperation({
    summary: "It creates a new dataset which can be a raw or derived one.",
    description:
      "It creates a new dataset and returns it completed with systems fields.",
  })
  @ApiBody({
    description: "Input fields for the dataset to be created",
    required: true,
    type: CreateDatasetDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: OutputDatasetDto,
    description: "Create a new dataset and return its representation in SciCat",
  })
  async create(
    @Req() request: Request,
    @Body()
    createDatasetDto: CreateDatasetDto,
  ): Promise<OutputDatasetDto> {
    this.validateDatasetPid(createDatasetDto);
    const datasetDto = await this.checkPermissionsForDatasetExtended(
      request,
      createDatasetDto,
      Action.DatasetCreate,
    );

    const createdDataset = await this.datasetsService.create(datasetDto);

    return createdDataset;
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetCreate, DatasetClass),
  )
  @UseInterceptors(
    new UTCTimeInterceptor<DatasetClass>(["creationTime"]),
    new UTCTimeInterceptor<DatasetClass>(["endTime"]),
    new FormatPhysicalQuantitiesInterceptor<DatasetClass>("scientificMetadata"),
  )
  @HttpCode(HttpStatus.OK)
  @Post("/isValid")
  @ApiOperation({
    summary: "It validates the dataset provided as input.",
    description:
      "It validates the dataset provided as input, and returns true if the information is a valid dataset",
  })
  @ApiBody({
    description: "Input fields for the dataset that needs to be validated",
    required: true,
    type: CreateDatasetDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: IsValidResponse,
    description:
      "Check if the dataset provided pass validation. It return true if the validation is passed",
  })
  async isValid(
    @Req() request: Request,
    @Body()
    createDatasetDto: CreateDatasetDto,
  ) {
    this.validateDatasetPid(createDatasetDto);

    const datasetDto = await this.checkPermissionsForDatasetExtended(
      request,
      createDatasetDto,
      Action.DatasetCreate,
    );

    const errors = await validate(datasetDto);

    const valid = errors.length === 0;

    return { valid: valid };
  }

  // GET /datasets
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @UseInterceptors(MainDatasetsPublicInterceptor)
  @Get()
  @ApiOperation({
    summary: "It returns a list of datasets.",
    description:
      "It returns a list of datasets. The list returned can be modified by providing a filter.",
  })
  @ApiQuery({
    name: "filter",
    description:
      "Database filters to apply when retrieving datasets\n" +
      filterDescription,
    required: false,
    type: String,
    example: filterExample,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    isArray: true,
    description: "Return the datasets requested",
  })
  async findAll(
    @Req() request: Request,
    @Headers() headers: Record<string, string>,
    @Query(new FilterPipe()) queryFilter: { filter?: string },
  ) {
    const mergedFilters = replaceLikeOperator(
      this.updateMergedFiltersForList(
        request,
        this.getFilters(headers, queryFilter),
      ) as Record<string, unknown>,
    ) as IFilters<DatasetDocument, IDatasetFields>;

    const includeFilters = this.getIncludeFilters(mergedFilters.include ?? []);

    // const datasets = await this.datasetsService.findAllComplete(mergedFilters, includeFilters);
    const datasets = await this.datasetsService.findAll(mergedFilters);

    return datasets;
  }

  // GET /fullfacets
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @UseInterceptors(SubDatasetsPublicInterceptor)
  @Get("/fullfacet")
  @ApiQuery({
    name: "filters",
    description:
      "Defines list of field names, for which facet counts should be calculated",
    required: false,
    type: FullFacetFilters,
    example:
      '{"facets": ["type","creationLocation","ownerGroup","keywords"], fields: {}}',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: FullFacetResponse,
    isArray: true,
    description: "Return fullfacet response for datasets requested",
  })
  async fullfacet(
    @Req() request: Request,
    @Query() filters: { fields?: string; facets?: string },
  ): Promise<Record<string, unknown>[]> {
    const user: JWTUser = request.user as JWTUser;
    const fields: IDatasetFields = JSON.parse(filters.fields ?? "{}");

    const ability = this.caslAbilityFactory.datasetInstanceAccess(user);
    const canViewAny = ability.can(Action.DatasetReadAny, DatasetClass);

    if (!canViewAny && !fields.isPublished) {
      const canViewAccess = ability.can(
        Action.DatasetReadManyAccess,
        DatasetClass,
      );
      const canViewOwner = ability.can(
        Action.DatasetReadManyOwner,
        DatasetClass,
      );

      if (canViewAccess) {
        fields.userGroups = fields.userGroups ?? [];
        fields.userGroups.push(...user.currentGroups);
      } else if (canViewOwner) {
        fields.ownerGroup = fields.ownerGroup ?? [];
        fields.ownerGroup.push(...user.currentGroups);
      }
    }

    const parsedFilters: IFacets<IDatasetFields> = {
      fields: fields,
      facets: JSON.parse(filters.facets ?? "[]"),
    };

    return this.datasetsService.fullFacet(parsedFilters);
  }

  // GET /datasets/metadataKeys
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @UseInterceptors(SubDatasetsPublicInterceptor)
  @Get("/metadataKeys")
  @ApiOperation({
    summary:
      "It returns a list of metadata keys contained in the datasets matching the filter provided.",
    description:
      "It returns a list of metadata keys contained in the datasets matching the filter provided.<br>This endpoint still needs some work on the filter and facets specification.",
  })
  @ApiQuery({
    name: "fields",
    description:
      "Define the filter conditions by specifying the name of values of fields requested. There is also support for a `text` search to look for strings anywhere in the dataset.",
    required: false,
    type: String,
    example: {},
  })
  @ApiQuery({
    name: "limits",
    description: "Define further query parameters like skip, limit, order",
    required: false,
    type: String,
    example: '{ "skip": 0, "limit": 25, "order": "creationTime:desc" }',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: String,
    isArray: true,
    description: "Return metadata keys  for list of datasets selected",
  })
  // NOTE: This one needs to be discussed as well but it gets the metadata keys from the dataset but it doesnt do it with the nested fields. Think about it
  async metadataKeys(
    @Req() request: Request,
    @Query() filters: { fields?: string; limits?: string },
  ) {
    const user: JWTUser = request.user as JWTUser;
    const fields: IDatasetFields = JSON.parse(filters.fields ?? "{}");

    const ability = this.caslAbilityFactory.datasetInstanceAccess(user);
    const canViewAny = ability.can(Action.DatasetReadAny, DatasetClass);

    if (!canViewAny && !fields.isPublished) {
      const canViewAccess = ability.can(
        Action.DatasetReadManyAccess,
        DatasetClass,
      );
      const canViewOwner = ability.can(
        Action.DatasetReadManyOwner,
        DatasetClass,
      );

      if (canViewAccess) {
        fields.userGroups?.push(...user.currentGroups);
      } else if (canViewOwner) {
        fields.ownerGroup?.push(...user.currentGroups);
      }
    }

    const parsedFilters: IFilters<DatasetDocument, IDatasetFields> = {
      fields: fields,
      limits: JSON.parse(filters.limits ?? "{}"),
    };
    return this.datasetsService.metadataKeys(parsedFilters);
  }

  // GET /datasets/findOne
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @Get("/findOne")
  @ApiOperation({
    summary: "It returns the first dataset found.",
    description:
      "It returns the first dataset of the ones that matches the filter provided. The list returned can be modified by providing a filter.",
  })
  @ApiQuery({
    name: "filter",
    description:
      "Database filters to apply when retrieving datasets\n" +
      filterDescription,
    required: false,
    type: String,
    example: filterExample,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    description: "Return the datasets requested",
  })
  async findOne(
    @Req() request: Request,
    @Headers() headers: Record<string, string>,
    @Query(new FilterPipe()) queryFilter: { filter?: string },
  ): Promise<OutputDatasetDto | null> {
    const mergedFilters = replaceLikeOperator(
      this.updateMergedFiltersForList(
        request,
        this.getFilters(headers, queryFilter),
      ) as Record<string, unknown>,
    ) as IFilters<DatasetDocument, IDatasetFields>;

    const includeFilters = this.getIncludeFilters(mergedFilters.include ?? []);

    return this.datasetsService.findOneComplete(mergedFilters, includeFilters);
  }

  // GET /datasets/count
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @Get("/count")
  @ApiOperation({
    summary: "It returns the number of datasets.",
    description:
      "It returns a number of datasets matching the where filter if provided.",
  })
  @ApiQuery({
    name: "filter",
    description: "Database filters to apply when retrieving count for datasets",
    required: false,
    type: String,
    example:
      '{"where": {"pid": "20.500.12269/4f8c991e-a879-4e00-9095-5bb13fb02ac4"}}',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: CountApiResponse,
    description:
      "Return the number of datasets in the following format: { count: integer }",
  })
  async count(
    @Req() request: Request,
    @Headers() headers: Record<string, string>,
    @Query(new FilterPipe()) queryFilter: { filter?: string },
  ) {
    const mergedFilters = replaceLikeOperator(
      this.updateMergedFiltersForList(
        request,
        this.getFilters(headers, queryFilter),
      ) as Record<string, unknown>,
    ) as IFilters<DatasetDocument, IDatasetFields>;

    return this.datasetsService.count(mergedFilters);
  }

  // GET /datasets/:id
  //@UseGuards(PoliciesGuard)
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  @Get("/:pid")
  @ApiParam({
    name: "pid",
    description: "Id of the dataset to return",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    isArray: false,
    description: "Return dataset with pid specified",
  })
  async findById(@Req() request: Request, @Param("pid") id: string) {
    // TODO: Do we want this to be sent as part of the request or we want to controll it here?
    // TODO: Add option to have "all" of them at once.
    const includeFields: DatasetLookupKeys[] = [
      "instruments",
      "attachments",
      "datablocks",
      "origdatablocks",
      "proposals",
      "samples",
    ];

    const dataset = await this.datasetsService.findOneComplete(
      {
        where: { pid: id },
      },
      includeFields,
    );

    await this.checkPermissionsForDatasetExtended(
      request,
      dataset,
      Action.DatasetRead,
    );

    return dataset;
  }

  // PATCH /datasets/:id
  // body: modified fields
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetUpdate, DatasetClass),
  )
  @UseInterceptors(
    new UTCTimeInterceptor<DatasetClass>(["creationTime"]),
    new UTCTimeInterceptor<DatasetClass>(["endTime"]),
    new FormatPhysicalQuantitiesInterceptor<DatasetClass>("scientificMetadata"),
    HistoryInterceptor,
  )
  @Patch("/:pid")
  @ApiOperation({
    summary: "It partially updates the dataset.",
    description:
      "It updates the dataset through the pid specified. It updates only the specified fields.",
  })
  @ApiParam({
    name: "pid",
    description: "Id of the dataset to modify",
    type: String,
  })
  @ApiBody({
    description:
      "Fields that needs to be updated in the dataset. Only the fields that needs to be updated have to be passed in.",
    required: true,
    type: UpdateDatasetDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    description:
      "Update an existing dataset and return its representation in SciCat",
  })
  async findByIdAndUpdate(
    @Req() request: Request,
    @Param("pid") pid: string,
    @Body()
    updateDatasetDto: PartialUpdateDatasetDto,
  ): Promise<OutputDatasetDto | null> {
    const foundDataset = await this.datasetsService.findOne({
      where: { pid },
    });

    await this.checkPermissionsForDatasetExtended(
      request,
      foundDataset,
      Action.DatasetUpdate,
    );

    const updatedDataset = await this.datasetsService.findByIdAndUpdate(
      pid,
      updateDatasetDto,
    );

    return updatedDataset;
  }

  // PUT /datasets/:id
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetUpdate, DatasetClass),
  )
  @UseInterceptors(
    new UTCTimeInterceptor<DatasetClass>(["creationTime"]),
    new UTCTimeInterceptor<DatasetClass>(["endTime"]),
    new FormatPhysicalQuantitiesInterceptor<DatasetClass>("scientificMetadata"),
    HistoryInterceptor,
  )
  @Put("/:pid")
  @ApiOperation({
    summary: "It updates the dataset.",
    description: `It updates(replaces) the dataset specified through the pid provided. If optional fields are not provided they will be removed.
      The PUT method is responsible for modifying an existing entity. The crucial part about it is that it is supposed to replace an entity.
      Therefore, if we don’t send a field of an entity when performing a PUT request, the missing field should be removed from the document.
      (Caution: This operation could result with data loss if all the dataset fields are not provided)`,
  })
  @ApiParam({
    name: "pid",
    description: "Id of the dataset to modify",
    type: String,
  })
  @ApiBody({
    description:
      "Dataset object that needs to be updated. The whole dataset object with updated fields have to be passed in.",
    required: true,
    type: UpdateDatasetDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    description:
      "Update an existing dataset and return its representation in SciCat",
  })
  async findByIdAndReplace(
    @Req() request: Request,
    @Param("pid") pid: string,
    @Body()
    updateDatasetDto: UpdateDatasetDto,
  ): Promise<OutputDatasetDto | null> {
    const foundDataset = await this.datasetsService.findOne({
      where: { pid },
    });

    await this.checkPermissionsForDatasetExtended(
      request,
      foundDataset,
      Action.DatasetUpdate,
    );

    const outputDatasetDto = await this.datasetsService.findByIdAndReplace(
      pid,
      updateDatasetDto,
    );

    return outputDatasetDto;
  }

  // DELETE /datasets/:id
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetDelete, DatasetClass),
  )
  @Delete("/:pid")
  @ApiOperation({
    summary: "It deletes the dataset.",
    description: "It delete the dataset specified through the pid specified.",
  })
  @ApiParam({
    name: "pid",
    description: "Id of the dataset to be deleted",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    description: "DatasetClass value is returned that is removed",
  })
  async findByIdAndDelete(@Req() request: Request, @Param("pid") pid: string) {
    const foundDataset = await this.datasetsService.findOne({
      where: { pid },
    });

    await this.checkPermissionsForDatasetExtended(
      request,
      foundDataset,
      Action.DatasetDelete,
    );

    const removedDataset = await this.datasetsService.findByIdAndDelete(pid);

    return removedDataset;
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetUpdate, DatasetClass),
  )
  @Post("/:pid/appendMetadataField")
  @ApiOperation({
    summary: "It appends a new value to the specific field.",
    description:
      "It appends a new value to the specified field of the dataset with provided pid.<br>The SciCat project is reviewing the purpose of this function and will decide if it will be dropped or changed",
  })
  @ApiParam({
    name: "pid",
    description: "Id of the dataset to be modified",
    type: String,
  })
  @ApiQuery({
    name: "fieldName",
    description: "Name of the field to be updated",
    type: String,
  })
  @ApiQuery({
    name: "data",
    description: "Json object with the fields to be updated and their values",
    required: true,
    type: Array,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OutputDatasetDto,
    description: "Return new value of the dataset",
  })
  // TODO: appendMetadataField new name and check inputs
  async appendMetadataField(
    @Req() request: Request,
    @Param("pid") pid: string,
    // @Query("fieldName") fieldName: string,
    @Query("data") data: string,
  ): Promise<OutputDatasetDto | null> {
    const datasetToUpdate = await this.datasetsService.findOne({
      where: { pid },
    });

    await this.checkPermissionsForDatasetExtended(
      request,
      datasetToUpdate,
      Action.DatasetUpdate,
    );

    const parsedData = JSON.parse(data);

    const updateQuery: UpdateQuery<DatasetDocument> = {
      $addToSet: {
        scientificMetadata: { $each: parsedData },
      },
    };

    const outputDatasetDto = await this.datasetsService.findByIdAndUpdate(
      pid,
      updateQuery,
    );

    return outputDatasetDto;
  }

  // TODO: Include the first attachment as thumbnail and we already include the attachments in the lookup. If possible remove this endpoint
  // GET /datasets/:id/thumbnail
  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetRead, DatasetClass),
  )
  // @UseGuards(PoliciesGuard)
  @Get("/:pid/thumbnail")
  @ApiOperation({
    summary: "It returns the thumbnail associated with the dataset.",
    description:
      "It returns the thumbnail associated with the dataset with the provided pid.",
  })
  @ApiParam({
    name: "pid",
    description: "Persistent identifier of the dataset",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Attachment,
    description: "Return new value of the dataset",
  })
  async thumbnail(
    @Req() request: Request,
    @Param("pid") pid: string,
  ): Promise<Partial<Attachment>> {
    await this.checkPermissionsForDatasetExtended(
      request,
      pid,
      Action.DatasetRead,
    );

    const attachment = await this.attachmentsService.findOne(
      { datasetId: pid },
      { _id: false, thumbnail: true },
    );

    if (!attachment || !attachment.thumbnail) {
      return {};
    }

    return attachment;
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies("datasets", (ability: AppAbility) =>
    ability.can(Action.DatasetLogbookRead, DatasetClass),
  )
  @Get("/:pid/logbook")
  @ApiOperation({
    summary: "Retrive logbook associated with dataset.",
    description: "It fetches specific logbook based on dataset pid.",
  })
  @ApiParam({
    name: "pid",
    description:
      "Persistent identifier of the dataset for which we would like to delete the datablock specified",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Logbook,
    isArray: false,
    description: "It returns all messages from specificied Logbook room",
  })
  async findLogbookByPid(
    @Req() request: Request,
    @Param("pid") pid: string,
    @Query("filters") filters: string,
  ) {
    const dataset = await this.checkPermissionsForDatasetExtended(
      request,
      pid,
      Action.DatasetLogbookRead,
    );

    const proposalId = (dataset?.proposalIds || [])[0];

    if (!proposalId) return null;

    const result = await this.logbooksService.findByName(proposalId, filters);

    return result;
  }
}
