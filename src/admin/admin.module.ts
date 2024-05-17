import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { CaslAbilityFactory } from "src/casl/casl-ability.factory";
import { MongooseModule } from "@nestjs/mongoose";
import { AppSettings, AppSettingsSchema } from "./schema/appSettings.schema";

@Module({
  controllers: [AdminController],
  imports: [
    MongooseModule.forFeature([
      {
        name: AppSettings.name,
        schema: AppSettingsSchema,
      },
    ]),
  ],
  providers: [AdminService, CaslAbilityFactory],
  exports: [AdminService],
})
export class AdminModule {}
