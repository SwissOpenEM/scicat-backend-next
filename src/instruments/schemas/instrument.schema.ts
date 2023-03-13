import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { Document } from "mongoose";
import { DatasetClass } from "src/datasets/schemas/dataset.schema";
import { v4 as uuidv4 } from "uuid";

export type InstrumentDocument = Instrument & Document;

@Schema({
  collection: "Instrument",
  minimize: false,
  timestamps: true,
  toJSON: {
    getters: true,
  },
})
export class Instrument {
  @ApiProperty({
    type: String,
    default: function genUUID(): string {
      return (process.env.PID_PREFIX ? process.env.PID_PREFIX : "") + uuidv4();
    },
    required: true,
    description: "PID of the instrument",
  })
  @Prop({
    type: String,
    unique: true,
    required: true,
    default: function genUUID(): string {
      return (process.env.PID_PREFIX ? process.env.PID_PREFIX : "")  + uuidv4();
    },
  })
  pid: string;

  @Prop({ 
    type: String 
  })
  _id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The name of the instrument.",
  })
  @Prop({ 
    type: String, 
    required: true 
  })
  name: string;

  @ApiProperty({
    type: Object,
    required: false,
    default: {},
    description: "JSON object containing custom metadata",
  })
  @Prop({ 
    type: Object, 
    required: false, 
    default: {} 
  })
  customMetadata: Record<string, unknown>;
}

export const InstrumentSchema = SchemaFactory.createForClass(Instrument);

InstrumentSchema.index({ "$**": "text" });
