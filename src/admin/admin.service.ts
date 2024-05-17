import { Injectable, OnModuleInit } from "@nestjs/common";
import config from "../config/frontend.config.json";
import theme from "../config/frontend.theme.json";
import { AppSettings } from "./schema/appSettings.schema";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectModel(AppSettings.name) private appSettingsModel: Model<AppSettings>,
  ) {}
  async onModuleInit() {
    this.appSettingsModel.find({}).then((settings) => {
      Object.entries(theme.properties).forEach(([key, value]) => {
        this.appSettingsModel;
      });
    });
  }
  async getConfig(): Promise<Record<string, unknown> | null> {
    return config;
  }

  async getTheme(): Promise<Record<string, unknown> | null> {
    return theme;
  }

  async updateAppSetting(
    sesttingName: string,
    settingsValue: string | number | boolean,
  ): Promise<void> {
    return;
  }
}
