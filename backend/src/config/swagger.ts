import swaggerJSDoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SEO & GEO Health Checker API',
    version: '1.0.0',
    description: 'Comprehensive API for analyzing websites for SEO and GEO (Generative Engine Optimization) factors',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3001',
      description: 'Development server'
    }
  ],
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            example: 'Validation failed'
          },
          message: {
            type: 'string',
            example: 'Request validation failed'
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            }
          }
        }
      },
      ValidationResult: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          valid: {
            type: 'boolean'
          },
          normalizedUrls: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: {
                  type: 'string'
                },
                error: {
                  type: 'string'
                }
              }
            }
          }
        }
      },
      AnalysisJob: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          jobId: {
            type: 'string',
            format: 'uuid'
          },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
          },
          urls: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      AnalysisStatus: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          jobId: {
            type: 'string',
            format: 'uuid'
          },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
          },
          progress: {
            type: 'object',
            properties: {
              completed: {
                type: 'number'
              },
              total: {
                type: 'number'
              },
              percentage: {
                type: 'number'
              }
            }
          },
          currentUrl: {
            type: 'string'
          },
          estimatedTimeRemaining: {
            type: 'number'
          }
        }
      },
      AnalysisResults: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          jobId: {
            type: 'string',
            format: 'uuid'
          },
          results: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PageAnalysisResult'
            }
          },
          summary: {
            type: 'object',
            properties: {
              averageScore: {
                type: 'number'
              },
              totalPages: {
                type: 'number'
              },
              completedAt: {
                type: 'string',
                format: 'date-time'
              }
            }
          }
        }
      },
      PageAnalysisResult: {
        type: 'object',
        properties: {
          url: {
            type: 'string'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          overallScore: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          seoScore: {
            $ref: '#/components/schemas/SEOScore'
          },
          geoScore: {
            $ref: '#/components/schemas/GEOScore'
          },
          recommendations: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Recommendation'
            }
          }
        }
      },
      SEOScore: {
        type: 'object',
        properties: {
          overall: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          technical: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          content: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          structure: {
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      },
      GEOScore: {
        type: 'object',
        properties: {
          overall: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          readability: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          credibility: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          completeness: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          structuredData: {
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      },
      Recommendation: {
        type: 'object',
        properties: {
          id: {
            type: 'string'
          },
          category: {
            type: 'string',
            enum: ['SEO', 'GEO', 'Technical']
          },
          priority: {
            type: 'string',
            enum: ['High', 'Medium', 'Low']
          },
          impact: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          effort: {
            type: 'string',
            enum: ['Easy', 'Medium', 'Hard']
          },
          title: {
            type: 'string'
          },
          description: {
            type: 'string'
          },
          actionSteps: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          example: {
            type: 'string'
          }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Bad request - validation failed',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      TooManyRequests: {
        description: 'Too many requests - rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);