import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

// Reusable Swagger decorator that wraps responses in your standard envelope
export function ApiWrappedResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          message: { type: 'string', example: 'Success' },
          data: { $ref: getSchemaPath(model) },
          timestamp: { type: 'string', example: new Date().toISOString() },
        },
      },
    }),
  );
}
