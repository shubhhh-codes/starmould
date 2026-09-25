<?php

namespace App\Models;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class UserModel extends Model
{
    use SoftDeletes;
    protected $table = 'users';
}
