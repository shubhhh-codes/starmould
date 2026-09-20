<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Dispatch Challan</title>
    <style>
            body { font-family: sans-serif; font-size: 12px; margin: 0; padding: 0; }
    .container { width: 100%; padding: 0px 0px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 10px; }
    .header h2 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .header p { margin: 2px 0; font-size: 12px; }

    .section { margin-bottom: 10px; }
    .section-title { background: #f0f0f0; font-weight: bold; padding: 5px; }
    .two-col { display: flex; justify-content: space-between; }
    .two-col div { width: 48%; }

    .info-table, .item-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .info-table td { padding: 5px 10px; font-size: 12px; }
    .item-table th, .item-table td { border: 1px solid #888; padding: 6px; text-align: left; }
    .item-table th { background: #f8f8f8; font-weight: bold; }
    /* .item-table tr:nth-child(even) { background: #fcfcfc; } */
    .item-table td { background: #fff; }

    .signature { margin-top: 40px; text-align: right; }
    .footer-note { font-size: 10px; margin-top: 15px; }
</style>
<style>
  @page {
    margin-top: 0;
    margin-right: 10mm;
    margin-bottom: 10mm;
    margin-left: 10mm;
  }

  body {
    margin: 0;
    padding: 0;
  }

  .header {
    margin-top: 0;
    padding-top: 0;
  }

  .header h1 {
    margin: 0;
    padding: 0;
    line-height: 1.1;
  }
        .item-table tr {
            page-break-inside: avoid; /* Prevent rows from breaking across pages */
        }

        .signature {
            margin-top: 40px;
            text-align: right;
        }

        .footer-note {
            font-size: 10px;
            margin-top: 15px;
        }

        @page {
            margin-top: 5mm;
            margin-right: 10mm;
            margin-bottom: 10mm;
            margin-left: 10mm;
        }
    </style>
</head>
<body>

@php
    $data = $cdata[0] ?? null;
@endphp

<div class="container">
    <!-- Header -->
    <div class="header">
        <h1>DISPATCH CHALLAN</h1>
        <p><strong>STARMOULD TECHNOLOGY PVT. LTD.</strong></p>
        <p>G -705, Near Swaminarayan Restaurant, Road-5, GIDC Metoda, Rajkot - 360021</p>
        <p>8238451671 | info.starmould@yahoo.com | GSTIN: 24ABLCS1427Q1ZV</p>
    </div>

    <!-- Two-column layout -->
    <table style="width: 100%; border-collapse: collapse;">
        <tr>
            <!-- Left Column -->
            <td style="width: 70%; vertical-align: top; padding-right: 10px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold; width: 15%;">Client Name:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->customername ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Address:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->address ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Contact:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->mobile ?? '' }} / {{ $data->mobile1 ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Challan No:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->challanno ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Invoice No:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->invoiceno ?? '' }}</td>
                        
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Date:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ \Carbon\Carbon::parse($data->chdate ?? '')->format('d/m/Y') }}</td>
                    </tr>
                </table>
            </td>

            <!-- Right Column -->
            <td style="width: 30%; vertical-align: top; padding-left: 10px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;  width: 40%;">Transporter:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->transportername ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Vehicle No:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->vehicleno ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Delivery Type:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->deliverytype ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Freight Mode:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->freightmode ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">Freight Charge:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->freightcharge ?? '' }}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #888; padding-left: 8px; font-weight: bold;">No. of Cases:</td>
                        <td style="border: 1px solid #888; padding-left: 8px;">{{ $data->noofcases ?? '' }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- Item Table -->
    <div class="section">
        <table class="item-table">
            <thead>
                <tr>
                <th style="width: 5%;">No.</th>
                    <th style="width: 10%;">Mould</th>
                    <th style="width: 5%;">Qty</th>
                    <th style="width: 20%;">Plate Name</th>
                    <th style="width: 40%;">Particulars</th>
                    <th style="width: 10%;">Condition</th>
                    <th style="width: 10%;">Work</th>
                </tr>
            </thead>
            <tbody>
                @foreach($cdata as $index => $item)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td>{{ $item->project ?? '' }}</td>
                        <td>{{ $item->qty ?? '' }}</td>
                        <td>{{ $item->platename ?? '' }}</td>
                        <td>{{ $item->particulars ?? '' }}</td>
                        <td>{{ $item->condition ?? '' }}</td>
                        <td>{{ $item->work ?? '' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Signature at the end of the document -->
    <!-- <div class="signature">
        <p>For, <strong>STARMOULD TECHNOLOGY PVT. LTD.</strong></p>
        <br><br>
        <p>Authorised Signature</p>
    </div> -->


    <div style="text-align: center; margin-top: 20px;">
        -- END OF CHALLAN --
    </div>

    <div class="footer-note">
        <p>Note: This is a system-generated challan. No signature required if sent digitally.</p>
    </div>

    <div style="position: fixed; bottom: 10px; width: 100%; text-align: right; font-size: 10px;">
        <!-- Page <span class="pageNumber"></span> -->
    </div>
</div>

</body>
</html>