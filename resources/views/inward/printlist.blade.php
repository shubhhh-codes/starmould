<html>
    <head>
        <style>
            /** Define the margins of your page **/
            @page {
                margin: 20px 15px 40px 15px;
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
                margin-bottom: 0.5rem;
            }
            strong {
                font-weight: 500;
                padding-bottom: 50 !important;
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
            h4, .h4 {
                /* font-size: 1.5rem; */
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
        </style>
    </head>
    <body>
    <main>
        <table class="test mt-0">
            <tbody>
                <tr>
                    <td class="text-center">
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {{-- <img src="{{ URL::asset('/assets/images/starmould.png') }}" alt="" > --}}
                    <td>
                    <td class="text-center">
                        <u>INWARD CHALLAN</u>
                    <td>
                    <td class="text-right" style="font-size: 18px !important;">
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        {{-- Original --}}
                    <td>
                </tr>
        </table>
        <table class="table">
            <tbody>
                <tr>
                    <td class="px-0" width="40%">
                    <img src="{{ URL::asset('/assets/images/challanlogo.jpg') }}" alt="" ><br>
                    <br>
                    <p><strong style="font-size:22.5px !important;">STARMOULD TECHNOLOGY PVT. LTD.</strong></p>
                    <i class="bx bxs-map"></i>  G -705, Near Swaminarayan Restaurant,<br> Road-5, GIDC Metoda, Rajkot - 360021<br>
                    <i class="bx bxs-phone"></i>  8238451671<br>
                    <i class="bx bx-mail-send"></i>  info.starmould@yahoo.com
                    </td>
                    <td class="border-0" width="0.5%"></td>
                    <td class="px-0" width="50%">
                       {{-- {{$cdata}} --}}
                       
                      <br> 
                      <p><strong>Vendor Name : </strong><strong style="font-size:26px !important;">{{$cdata[0]->customername}}</strong>
                      <p><strong>Inward Challan No : </strong>{{$cdata[0]->inchallanno}}</p>
                        <p><strong>Date : </strong>{{$formattedDate}}</p>
                        <p><strong>Job Work Challan No : </strong>{{$cdata[0]->challanno}}</p>
                        {{-- <strong>Vendor Address : </strong>{{$cdata[0]->address}}<br> --}}
                        <p><strong>Contact No : </strong>{{$cdata[0]->mobile}} / {{$cdata[0]->mobile1}}</p>
                        <p><strong>Transporter Name : </strong>{{$cdata[0]->cname}}</p>
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
                
                <th style="width: 9%;"><strong>Total Qty</strong></th>
                <th style="width: 10%;"><strong>Inward Qty</strong></th>
                </tr>
            </thead>
            <tbody>
                {{-- Items --}}
                @foreach ($cdata as $index => $inward)
            <tr>
                {{-- {{$cdata}} --}}
                <td>{{ $index + 1 }}</td>
                <td>{{ $inward['particulars'] }}</td>
                <td>{{ $inward['platename'] }}</td>
                
                <td>{{ $inward['project'] }}</td>
               
                <td>{{ $inward['qty'] }}</td>
                <td>{{ $inward['inward_qty'] }}</td>
            </tr>
            @endforeach
            </tbody>
        </table>
    </main>
        <!-- Define header and footer blocks before your content -->
           
        <footer class="text-right">
            {{-- For, STARMOULD TECHNOLOGY PVT. LTD.  --}}
        </footer>

        <!-- Wrap the content of your PDF inside a main tag -->
       
    </body>
</html>