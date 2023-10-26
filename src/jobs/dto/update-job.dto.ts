import { ApiProperty,  PartialType } from "@nestjs/swagger";
import { CreateJobDto } from "./create-job.dto";
import {
    //IsArray,
    //IsDateString,
    //IsEmail,
    //IsObject,
    //IsOptional,
    IsString,
    //ValidateNested,
  } from "class-validator";

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiProperty({
    type: String,
    required: true,
    description: "Id for the job to be updated.",
  })
  @IsString()
  readonly id: string;
}
