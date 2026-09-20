<html>
    <head>
        <style>
            /** Define the margins of your page **/
            @page {
                margin: 50px 15px 50px 15px;
            }
            footer {
                position: fixed; 
                bottom: 0px; 
                left: 0px; 
                right: 0px;
                /* height: 100px;  */

                /** Extra personal styles **/
                /* background-color: #03a9f4; */
                color: rgb(9, 9, 9);
                text-align: center;
                /* line-height: 25px; */
            }
            .test{
            width: 100%;
            border-collapse: collapse;
            }
            .test2{
            width: 100%;
            border-collapse: collapse;
            }
          
            h4 {
                margin-top: 0;
                margin-bottom: 0.5rem;
            }
            p {
                margin-top: 0;
                margin-bottom: 1rem;
            }
            strong {
                font-weight: 500;
            }
            right-x {
                text-align: right !important;
            }
            img {
                vertical-align: middle;
                border-style: none;
            }
            table {
                border-collapse: collapse;
            }
            th {
                text-align: inherit;
            }
            h4, .h4 {
                margin-bottom: 0.5rem;
                font-weight: 500;
                line-height: 1.2;
            }
            h5, .h5{
                margin-top: 0;
                margin-bottom: 0;
                /* font-size: 1.5rem; */
                font-weight: unset;
                text-align: center !important;
            }
            .table {
                width: 100%;
                margin-bottom: 1rem;
                color: #212529;
                font-size: 20px;
            }
            .table th,
            .table td {
                /* padding: 0.75rem; */
                vertical-align: top;
            }
            .table.table-items td {
                border-top: 1px solid #dee2e6;
                font-size: 19px;
            }
            .table thead th {
                vertical-align: bottom;
                border-bottom: 2px solid #dee2e6;
            }
            .mt-5 {
                margin-top: 3rem !important;
            }
            .mt-0 {
                margin-top: 0 !important;
            }
            .mb-0 {
                margin-bottom: 0 !important;
            }
            .pr-0,
            .px-0 {
                padding-right: 0 !important;
            }
            .pl-0,
            .px-0 {
                padding-left: 0 !important;
            }
            .text-left {
                text-align: left !important;
            }
            .text-right {
                text-align: right !important;
            }
            .text-center {
                text-align: center !important;
            }
            .text-uppercase {
                text-transform: uppercase !important;
            }
            * {
                font-family: "DejaVu Sans";
            }
            body, h1, h2, h3, h4, h5, h6, table, th, tr, td, p, div {
                line-height: 1.1;
            }
            .party-header {
                /* font-size: 1.5rem; */
                font-weight: 400;
            }
            .total-amount {
                /* font-size: 12px; */
                font-weight: 600;
            }
            .border-0 {
                border: none !important;
            }
            .cool-gray {
                color: #6B7280;
            }
            footer {
                position: fixed; 
                bottom: -60px; 
                left: 0px; 
                right: 0px;
                height: 50px;
            }
            
            /* Fix for page spacing */
            .page-break-with-spacing {
                page-break-before: always;
                margin-top: 40px !important; /* Add space at top of new page */
            }
         
        </style>
    </head>
    <body>
        <main>
            <table class="test mt-0">
                <tbody>
                    <tr>
                        <td class="text-center">
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                        </td>
                        <td></td>
                        <td class="text-center">
                            <u>DELIVERY / JOB WORK CHALLAN</u>
                        </td>
                        <td></td>
                        <td class="text-right" style="font-size: 18px !important;">
                            Original
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="table">
                <tbody>
                    <tr>
                        <td class="px-0" width="40%">
                            <img src="{{ URL::asset('/assets/images/challanlogo.jpg') }}" alt=""><br>
                            <br>
                            <strong style="font-size:22.5px !important;">STARMOULD TECHNOLOGY PVT. LTD.</strong><br>
                            <i class="bx bxs-map"></i> G -705, Near Swaminarayan Restaurant,<br> Road-5, GIDC Metoda, Rajkot - 360021<br>
                            <i class="bx bxs-phone"></i> 8238451671 - info.starmould@yahoo.com<br>GSTIN: 24ABLCS1427Q1ZV
                            
                        </td>
                        <td class="border-0" width="0.5%"></td>
                        <td class="px-0" width="50%">
                            {{-- {{$cdata}} --}}
                            <br>
                            <strong>Client Name: </strong><strong style="font-size:26px !important;">{{$cdata[0]->customername}}</strong><br>
                            <strong>Dispatch Challan No: </strong>{{$cdata[0]->challanno}}<br>
                            <strong>Date: </strong>{{$formattedDate}}<br>
                            <strong>Client Address: </strong>{{$cdata[0]->address}}<br>
                            <strong>Contact No: </strong>{{$cdata[0]->mobile}} / {{$cdata[0]->mobile1}}<br>
                            <strong>Transporter Name: </strong>{{$cdata[0]->cname}}
                            <br>
                            <strong>Invoice No. </strong>{{$cdata[0]->invoiceno}}<br>
                            <strong>Vehicle No. </strong>{{$cdata[0]->vehicleno}}<br>
                            <strong>Delivery Type: </strong>{{$cdata[0]->deliverytype}}<br>
                            <strong>Freight Charge: </strong>{{$cdata[0]->freightcharge}}<br>
                            <strong>Freight Mode: </strong>{{$cdata[0]->freightmode}}<br>
                            <strong>No. of Cases: </strong>{{$cdata[0]->mobile}}<br>
                            
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="table table-items">
                <thead style="background-color: #dee2e6;">
                    <tr>
                        <th style="width: 3%;"><strong>No.</strong></th>
                        <th style="width: 15%;"><strong>Mould</strong></th>
                        <th style="width: 15%;"><strong>Plate Name</strong></th>
                        <th style="width: 15%;"><strong>Particulars</strong></th>
                        <th style="width: 10%;"><strong>Condition</strong></th>
                        <th style="width: 10%;"><strong>Work</strong></th>
                        <th style="width: 3%;"><strong>Qty</strong></th>
                    </tr>
                </thead>
                <tbody>
                    {{-- Items --}}
                    @foreach ($cdata as $index => $challan)
                        <tr>
                            {{-- {{$cdata}} --}}
                            <td>{{ $index + 1 }}</td>
                            <td>{{ $challan['project'] }}</td>
                            <td>{{ $challan['platename'] }}</td> 
                            <td>{{ $challan['particulars'] }}</td>
                            <td>{{ $challan['particulars'] }}</td>
                            <td>{{ $challan['particulars'] }}</td>
                            <td>{{ $challan['qty'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </main>
        <footer class="text-right">
            For, STARMOULD TECHNOLOGY PVT. LTD.
            <br><br>
        </footer>
        
        <!-- Duplicate copy starts here with proper spacing -->
        <main class="page-break-with-spacing">
            <table class="test mt-0">
                <tbody>
                    <tr>
                        <td class="text-center">
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                        </td>
                        <td></td>
                        <td class="text-center">
                            <u>DELIVERY / JOB WORK CHALLAN</u>
                        </td>
                        <td></td>
                        <td class="text-right" style="font-size: 18px !important;">
                            Duplicate
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="table">
                <tbody>
                    <tr>
                        <td class="px-0" width="40%">
                            <img src="{{ URL::asset('/assets/images/challanlogo.jpg') }}" alt=""><br>
                            <br>
                            <strong style="font-size:22.5px !important;">STARMOULD TECHNOLOGY PVT. LTD.</strong><br>
                            <i class="bx bxs-map"></i> G -705, Near Swaminarayan Restaurant,<br> Road-5, GIDC Metoda, Rajkot - 360021<br>
                            <i class="bx bxs-phone"></i> 8238451671 - info.starmould@yahoo.com<br>GSTIN: 24ABLCS1427Q1ZV
                            
                        </td>
                        <td class="border-0" width="0.5%"></td>
                        <td class="px-0" width="50%">
                            {{-- {{$cdata}} --}}
                            <br>
                            <strong>Vendor Name: </strong><strong style="font-size:26px !important;">{{$cdata[0]->customername}}</strong><br>
                            <strong>Job Work Challan No: </strong>{{$cdata[0]->challanno}}<br>
                            <strong>Date: </strong>{{$formattedDate}}<br>
                            <strong>Vendor Address: </strong>{{$cdata[0]->address}}<br>
                            <strong>Contact No: </strong>{{$cdata[0]->mobile}} / {{$cdata[0]->mobile1}}<br>
                            <strong>Transporter Name: </strong>{{$cdata[0]->cname}}
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="table table-items">
                <thead style="background-color: #dee2e6;">
                    <tr>
                        <th style="width: 5%;"><strong>No.</strong></th>
                        <th><strong>Particulars</strong></th>
                        <th style="width: 25%;"><strong>Plate Name</strong></th>
                        <th style="width: 15%;"><strong>Mould</strong></th>
                        <th style="width: 5%;"><strong>Qty</strong></th>
                    </tr>
                </thead>
                <tbody>
                    {{-- Items --}}
                    @foreach ($cdata as $index => $challan)
                        <tr>
                            {{-- {{$cdata}} --}}
                            <td>{{ $index + 1 }}</td>
                            <td>{{ $challan['particulars'] }}</td>
                            <td>{{ $challan['platename'] }}</td>
                            <td>{{ $challan['project'] }}</td>
                            <td>{{ $challan['qty'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </main>
        {{-- <footer class="text-right">
            For, STARMOULD TECHNOLOGY PVT. LTD.
        </footer> --}}
    </body>
    </html>