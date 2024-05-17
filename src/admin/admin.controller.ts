import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { AllowAny } from "src/auth/decorators/allow-any.decorator";
import { PoliciesGuard } from "src/casl/guards/policies.guard";
import { CheckPolicies } from "src/casl/decorators/check-policies.decorator";
import { Action } from "src/casl/action.enum";
import { AppAbility } from "src/casl/casl-ability.factory";
import { ElasticSearchActions } from "src/elastic-search/dto";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @AllowAny()
  @Get("config")
  async getConfig(): Promise<Record<string, unknown> | null> {
    return this.adminService.getConfig();
  }

  @AllowAny()
  @Get("theme")
  async getTheme(): Promise<Record<string, unknown> | null> {
    return this.adminService.getTheme();
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, ElasticSearchActions),
  )
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: "Sync data to the index",
  })
  @Patch("/updateAppSetting")
  async updateSetting(
    @Query("settingName") settingName: string,
    @Query("settingValue") settingValue: string | number | boolean,
  ) {
    return this.adminService.updateAppSetting(settingName, settingValue);
  }
}
