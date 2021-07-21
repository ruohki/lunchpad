# Device inquiry
Request: 0xF0 0x7E 0x7F 0x06 0x01 0xF7
Response:
|F0 7E 00 06 02|00 20 29|69 00|00 00|00 01 07 01|F7
|F0 7E 00 06 02|00 20 29|13 01|00 00|00 03 01 00|F7
|              |        |     |     |           |
      SysEx    |        |     |     |           |
                Novation|     |     |           |
                        |     |     |           |
                       ProductID    |  Version  |
                            Device Family

 ProductID = DeviceID - Wich launchpad is wich