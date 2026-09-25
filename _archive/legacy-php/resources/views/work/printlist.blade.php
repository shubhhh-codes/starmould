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
            .table.table-items tr:nth-child(even){background-color: #f2f2f2;}
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
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                        </td>
                        <td></td>
                        <td class="text-center">
                            <u>WORKDATA</u>
                        </td>
                        <td></td>
                        <td class="text-right" style="font-size: 18px !important;">
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        </td>
                    </tr>
                </tbody>
            </table>
           <br>
            <table class="table table-items">
                <thead style="background-color: #dee2e6;">
                    <tr>
                        <th><strong>Date</strong></th>
                        <th><strong>Customer Name</strong></th>
                        <th><strong>Mould</strong></th>
                        <th><strong>Sub Plate</strong></th>
                        <th><strong>Worktype</strong></th>
                        <th><strong>Part Description</strong></th>
                        <th><strong>Username</strong></th>
                        <th><strong>Design HR</strong></th>
                        <th><strong>Prog HR</strong></th>
                        <th><strong>Mach HR</strong></th>
                        <th><strong>DT HR</strong></th>
                        <th><strong>QC HR</strong></th>
                        <th><strong>M HR</strong></th>
                    </tr>
                </thead>
                <tbody>
                    {{-- Items --}}
                 @foreach ($wdata as $index => $workdata)
                        <tr>
                            {{-- <td>{{ $index + 1 }}</td> --}}
                            <td>{{ $workdata['formatted_rdate'] }}</td>
                            <td>{{ $workdata['customername'] }}</td>
                            <td>{{ $workdata['projectid'] }}</td>
                            <td>{{ $workdata['platename'] }}</td>
                            <td>{{ $workdata['worktype'] }}</td>
                            <td>{{ $workdata['description'] }}</td>
                            <td>{{ $workdata['username'] }}</td>
                            <td>{{ $workdata['design_hr'] }}</td>
                            <td>{{ $workdata['program_hr'] }}</td>
                            <td>{{ $workdata['machine_hr'] }}</td>
                            <td>{{ $workdata['driltap_hr'] }}</td>
                            <td>{{ $workdata['qc_hr'] }}</td>
                            <td>{{ $workdata['work_hr'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </main>
    </body>
    </html>