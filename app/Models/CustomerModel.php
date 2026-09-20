<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class CustomerModel extends Model
{
    use SoftDeletes;
    protected $table = 'customers';
}
