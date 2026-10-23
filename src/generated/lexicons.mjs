// Generated from pkl/defs. Do not edit.
export const schemas = [
  {
    "lexicon": 1,
    "id": "app.citruswallet.acceptInvitation",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "token",
              "address"
            ],
            "properties": {
              "token": {
                "type": "string",
                "maxLength": 128
              },
              "address": {
                "type": "string",
                "maxLength": 42
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.address",
    "defs": {
      "main": {
        "type": "record",
        "key": "any",
        "description": "Public, signature-verified receiving address. chain is a CAIP-2 identifier (for example eip155:1). The record is public; verification still requires checking the signed proof and DID. Removing a record cannot erase previously indexed copies.",
        "record": {
          "type": "object",
          "required": [
            "chain",
            "address",
            "message",
            "signature",
            "createdAt"
          ],
          "properties": {
            "chain": {
              "type": "string",
              "maxLength": 64
            },
            "address": {
              "type": "string",
              "minLength": 42,
              "maxLength": 42
            },
            "message": {
              "type": "string",
              "maxLength": 8192
            },
            "signature": {
              "type": "string",
              "minLength": 132,
              "maxLength": 132
            },
            "createdAt": {
              "type": "string",
              "format": "datetime"
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.cancelPayment",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 64
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.createChallenge",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "address"
            ],
            "properties": {
              "address": {
                "type": "string",
                "maxLength": 42,
                "minLength": 42
              },
              "public": {
                "type": "boolean"
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#challenge"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.createInvitation",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 64
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#invitationResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.createPayment",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "identifier",
              "expectedDid",
              "amount"
            ],
            "properties": {
              "identifier": {
                "type": "string",
                "maxLength": 2048
              },
              "expectedDid": {
                "type": "string",
                "maxLength": 2048
              },
              "media": {
                "type": "ref",
                "ref": "lex:app.citruswallet.defs#paymentMedia"
              },
              "description": {
                "type": "string",
                "maxLength": 2000,
                "maxGraphemes": 500
              },
              "amount": {
                "type": "string",
                "maxLength": 80
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "payment",
              "invitationUrl"
            ],
            "properties": {
              "payment": {
                "type": "ref",
                "ref": "lex:app.citruswallet.defs#payment"
              },
              "invitationUrl": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.defs",
    "defs": {
      "actor": {
        "type": "object",
        "required": [
          "did",
          "handle",
          "displayName",
          "avatar"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "handle": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "nullable": [
          "displayName",
          "avatar"
        ]
      },
      "currency": {
        "type": "object",
        "required": [
          "name",
          "symbol",
          "decimals"
        ],
        "properties": {
          "name": {
            "type": "string"
          },
          "symbol": {
            "type": "string"
          },
          "decimals": {
            "type": "integer"
          }
        }
      },
      "network": {
        "type": "object",
        "required": [
          "chainId",
          "chainIdHex",
          "name",
          "nativeCurrency"
        ],
        "properties": {
          "chainId": {
            "type": "integer"
          },
          "chainIdHex": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "nativeCurrency": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#currency"
          },
          "rpcUrls": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "link": {
        "type": "object",
        "required": [
          "did",
          "address",
          "chain_id",
          "message",
          "signature",
          "linked_at",
          "public",
          "is_default"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "address": {
            "type": "string"
          },
          "chain_id": {
            "type": "integer"
          },
          "message": {
            "type": "string"
          },
          "signature": {
            "type": "string"
          },
          "linked_at": {
            "type": "string"
          },
          "public": {
            "type": "boolean"
          },
          "is_default": {
            "type": "boolean"
          }
        }
      },
      "session": {
        "type": "object",
        "required": [
          "network",
          "paymentsEnabled",
          "did",
          "csrf",
          "links",
          "addressSyncPending"
        ],
        "properties": {
          "network": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#network"
          },
          "paymentsEnabled": {
            "type": "boolean"
          },
          "did": {
            "type": "string"
          },
          "csrf": {
            "type": "string"
          },
          "links": {
            "type": "array",
            "items": {
              "type": "ref",
              "ref": "lex:app.citruswallet.defs#link"
            }
          },
          "addressSyncPending": {
            "type": "boolean"
          }
        },
        "nullable": [
          "did"
        ]
      },
      "paymentState": {
        "type": "string",
        "knownValues": [
          "waiting",
          "ready",
          "prepared",
          "submitted",
          "confirming",
          "confirmed",
          "failed",
          "cancelled",
          "expired"
        ]
      },
      "payment": {
        "type": "object",
        "required": [
          "id",
          "senderDid",
          "recipientDid",
          "recipientLabel",
          "chainId",
          "asset",
          "amount",
          "amountWei",
          "state",
          "address",
          "revision",
          "source",
          "createdAt",
          "expiresAt",
          "txHash",
          "error",
          "confirmationsRequired"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "senderDid": {
            "type": "string"
          },
          "recipientDid": {
            "type": "string"
          },
          "recipientLabel": {
            "type": "string"
          },
          "chainId": {
            "type": "integer"
          },
          "asset": {
            "type": "string"
          },
          "amount": {
            "type": "string"
          },
          "media": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentMedia"
          },
          "description": {
            "type": "string",
            "maxLength": 2000,
            "maxGraphemes": 500
          },
          "sender": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#actor"
          },
          "recipient": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#actor"
          },
          "amountWei": {
            "type": "string"
          },
          "state": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentState"
          },
          "address": {
            "type": "string"
          },
          "revision": {
            "type": "integer"
          },
          "source": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "expiresAt": {
            "type": "string"
          },
          "txHash": {
            "type": "string"
          },
          "error": {
            "type": "string"
          },
          "confirmationsRequired": {
            "type": "integer"
          },
          "attemptId": {
            "type": "string"
          },
          "fromAddress": {
            "type": "string"
          },
          "nonce": {
            "type": "integer"
          }
        },
        "nullable": [
          "address",
          "txHash",
          "error",
          "attemptId",
          "fromAddress",
          "nonce",
          "description",
          "media",
          "sender",
          "recipient"
        ]
      },
      "transaction": {
        "type": "object",
        "required": [
          "from",
          "to",
          "value",
          "chainId",
          "nonce",
          "data"
        ],
        "properties": {
          "from": {
            "type": "string"
          },
          "to": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "chainId": {
            "type": "string"
          },
          "nonce": {
            "type": "string"
          },
          "data": {
            "type": "string"
          }
        }
      },
      "attempt": {
        "type": "object",
        "required": [
          "payment",
          "attemptId",
          "transaction"
        ],
        "properties": {
          "payment": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#payment"
          },
          "attemptId": {
            "type": "string"
          },
          "transaction": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#transaction"
          }
        }
      },
      "recipient": {
        "type": "object",
        "required": [
          "did",
          "handle",
          "chainId",
          "address"
        ],
        "properties": {
          "did": {
            "type": "string"
          },
          "handle": {
            "type": "string"
          },
          "chainId": {
            "type": "integer"
          },
          "address": {
            "type": "string"
          }
        },
        "nullable": [
          "handle",
          "address"
        ]
      },
      "challenge": {
        "type": "object",
        "required": [
          "id",
          "address",
          "chainId",
          "message",
          "expiresAt"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "address": {
            "type": "string"
          },
          "chainId": {
            "type": "integer"
          },
          "message": {
            "type": "string"
          },
          "expiresAt": {
            "type": "string"
          }
        }
      },
      "linksResult": {
        "type": "object",
        "required": [
          "links"
        ],
        "properties": {
          "links": {
            "type": "array",
            "items": {
              "type": "ref",
              "ref": "lex:app.citruswallet.defs#link"
            }
          },
          "addressSyncPending": {
            "type": "boolean"
          }
        }
      },
      "paymentResult": {
        "type": "object",
        "required": [
          "payment"
        ],
        "properties": {
          "payment": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#payment"
          }
        }
      },
      "invitationResult": {
        "type": "object",
        "required": [
          "invitationUrl"
        ],
        "properties": {
          "invitationUrl": {
            "type": "string"
          }
        }
      },
      "paymentMedia": {
        "type": "object",
        "required": [
          "kind",
          "slug",
          "url",
          "preview",
          "title"
        ],
        "properties": {
          "kind": {
            "type": "string",
            "enum": [
              "gifs",
              "stickers",
              "static-memes",
              "clips"
            ]
          },
          "slug": {
            "type": "string",
            "maxLength": 200
          },
          "url": {
            "type": "string",
            "maxLength": 2048
          },
          "preview": {
            "type": "string",
            "maxLength": 2048
          },
          "title": {
            "type": "string",
            "maxLength": 300
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.deletePayment",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 64
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.exchangeNativeSession",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "code",
              "verifier"
            ],
            "properties": {
              "code": {
                "type": "string",
                "maxLength": 64
              },
              "verifier": {
                "type": "string",
                "maxLength": 64
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "token"
            ],
            "properties": {
              "token": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getAddresses",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "required": [
            "did"
          ],
          "properties": {
            "did": {
              "type": "string",
              "maxLength": 2048
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "did",
              "links"
            ],
            "properties": {
              "did": {
                "type": "string"
              },
              "links": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "lex:app.citruswallet.defs#link"
                }
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getInvitation",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "required": [
            "token"
          ],
          "properties": {
            "token": {
              "type": "string",
              "maxLength": 128
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getPayment",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "required": [
            "id"
          ],
          "properties": {
            "id": {
              "type": "string",
              "maxLength": 64
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getProfile",
    "defs": {
      "main": {
        "type": "query",
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "actor"
            ],
            "properties": {
              "actor": {
                "type": "ref",
                "ref": "lex:app.citruswallet.defs#actor"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getSession",
    "defs": {
      "main": {
        "type": "query",
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#session"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.getWebPushConfig",
    "defs": {
      "main": {
        "type": "query",
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "publicKey"
            ],
            "properties": {
              "publicKey": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.listNotifications",
    "defs": {
      "main": {
        "type": "query",
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "notifications",
              "unread"
            ],
            "properties": {
              "notifications": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "lex:app.citruswallet.listNotifications#notification"
                }
              },
              "unread": {
                "type": "integer"
              }
            }
          }
        }
      },
      "notification": {
        "type": "object",
        "required": [
          "id",
          "paymentId",
          "createdAt",
          "read"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 256
          },
          "paymentId": {
            "type": "string",
            "maxLength": 256
          },
          "createdAt": {
            "type": "string",
            "maxLength": 256
          },
          "read": {
            "type": "boolean"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.listPayments",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "properties": {
            "q": {
              "type": "string",
              "maxLength": 512
            },
            "direction": {
              "type": "string",
              "enum": [
                "all",
                "sent",
                "received"
              ]
            },
            "status": {
              "type": "string",
              "enum": [
                "all",
                "waiting",
                "ready",
                "prepared",
                "submitted",
                "confirming",
                "confirmed",
                "failed",
                "cancelled",
                "expired"
              ]
            },
            "after": {
              "type": "string",
              "maxLength": 15,
              "description": "Inclusive Unix timestamp in milliseconds, encoded as a decimal string."
            },
            "before": {
              "type": "string",
              "maxLength": 15,
              "description": "Inclusive Unix timestamp in milliseconds, encoded as a decimal string."
            },
            "page": {
              "type": "integer",
              "minimum": 1,
              "maximum": 1000000
            },
            "pageSize": {
              "type": "integer",
              "minimum": 1,
              "maximum": 50
            },
            "sort": {
              "type": "string",
              "enum": [
                "newest",
                "oldest"
              ]
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "payments",
              "total",
              "page",
              "pageSize"
            ],
            "properties": {
              "total": {
                "type": "integer"
              },
              "page": {
                "type": "integer"
              },
              "pageSize": {
                "type": "integer"
              },
              "payments": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "lex:app.citruswallet.defs#payment"
                }
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.logout",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [],
            "properties": {}
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.markAllNotificationsRead",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [],
            "properties": {}
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.markNotificationRead",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 256
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.preparePayment",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id",
              "revision",
              "address",
              "fromAddress"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 64
              },
              "revision": {
                "type": "integer",
                "minimum": 0
              },
              "address": {
                "type": "string",
                "maxLength": 42
              },
              "fromAddress": {
                "type": "string",
                "maxLength": 42
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#attempt"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.registerPushToken",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "token",
              "platform"
            ],
            "properties": {
              "token": {
                "type": "string",
                "maxLength": 256
              },
              "platform": {
                "type": "string",
                "enum": [
                  "android",
                  "ios"
                ]
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.registerWebPush",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "endpoint",
              "p256dh",
              "auth"
            ],
            "properties": {
              "endpoint": {
                "type": "string",
                "maxLength": 2048
              },
              "p256dh": {
                "type": "string",
                "maxLength": 100
              },
              "auth": {
                "type": "string",
                "maxLength": 32
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.resolveRecipient",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "identifier"
            ],
            "properties": {
              "identifier": {
                "type": "string",
                "maxLength": 2048
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#recipient"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.searchActors",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "required": [
            "q"
          ],
          "properties": {
            "q": {
              "type": "string",
              "maxLength": 64
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "actors"
            ],
            "properties": {
              "actors": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "lex:app.citruswallet.defs#actor"
                }
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.setDefaultAddress",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "address"
            ],
            "properties": {
              "address": {
                "type": "string",
                "maxLength": 42,
                "minLength": 42
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#linksResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.startLogin",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [],
            "properties": {
              "identifier": {
                "type": "string",
                "maxLength": 2048
              },
              "create": {
                "type": "boolean"
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "url"
            ],
            "properties": {
              "url": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.submitPayment",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id",
              "attemptId",
              "txHash"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 64
              },
              "attemptId": {
                "type": "string",
                "maxLength": 64
              },
              "txHash": {
                "type": "string",
                "maxLength": 66
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#paymentResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.subscribeNotifications",
    "defs": {
      "main": {
        "type": "query",
        "parameters": {
          "type": "params",
          "properties": {
            "cursor": {
              "type": "string",
              "maxLength": 256
            }
          }
        },
        "output": {
          "encoding": "text/event-stream"
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.syncAddresses",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [],
            "properties": {}
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "addressSyncPending"
            ],
            "properties": {
              "addressSyncPending": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.unlinkAddress",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "address"
            ],
            "properties": {
              "address": {
                "type": "string",
                "maxLength": 42,
                "minLength": 42
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#linksResult"
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.unregisterPushToken",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "token"
            ],
            "properties": {
              "token": {
                "type": "string",
                "maxLength": 256
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.unregisterWebPush",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "endpoint"
            ],
            "properties": {
              "endpoint": {
                "type": "string",
                "maxLength": 2048
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "ok"
            ],
            "properties": {
              "ok": {
                "type": "boolean"
              }
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "app.citruswallet.verifyChallenge",
    "defs": {
      "main": {
        "type": "procedure",
        "input": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "id",
              "signature"
            ],
            "properties": {
              "id": {
                "type": "string",
                "maxLength": 48
              },
              "signature": {
                "type": "string",
                "maxLength": 132
              }
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "lex:app.citruswallet.defs#linksResult"
          }
        }
      }
    }
  }
];
