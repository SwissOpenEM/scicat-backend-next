import { Injectable } from "@nestjs/common";
import {
  JobActionCreator,
  JobActionOptions,
  JobDto,
} from "../../jobconfig.interface";
import { URLJobAction } from "./urlaction";
import { isURLJobActionOptions } from "./urlaction.interface";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class URLJobActionCreator implements JobActionCreator<JobDto> {
  private readonly configService: ConfigService;
  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  public create<Options extends JobActionOptions>(options: Options) {
    if (!isURLJobActionOptions(options)) {
      throw new Error("Invalid options for URLJobAction.");
    }
    const token = this.configService.get<string>(options.authTokenEnvVar || "");
    return new URLJobAction(options, token || "");
  }
}
