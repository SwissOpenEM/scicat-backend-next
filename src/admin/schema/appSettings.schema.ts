import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AppSettingsDocument = AppSettings & Document;

@Schema({
  collection: "AppSettings",
  toJSON: {
    getters: true,
  },
  timestamps: { createdAt: "created", updatedAt: "modified" },
})
export class AppSettings {
  @Prop()
  settingName: string;

  @Prop()
  settingValue: Date;
}

export const AppSettingsSchema = SchemaFactory.createForClass(AppSettings);
